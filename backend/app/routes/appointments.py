"""
backend/app/routes/appointments.py

Full CRUD + workflow actions for appointments.
Used by service_information and fnb businesses.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import uuid

from app.database import get_db
from app.models.business import Business
from app.models.appointment import Appointment, AppointmentStatus
from app.schemas.appointment import AppointmentResponse, AppointmentUpdate, AppointmentCancel
from app.dependencies import get_current_business
from app.services.whatsapp_service import WhatsAppService

router = APIRouter(prefix="/appointments", tags=["Appointments"])


def _get_or_404(result) -> Appointment:
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Rendez-vous introuvable")
    return appt


async def _fetch(db: AsyncSession, appt_id: str, business_id) -> Appointment:
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == uuid.UUID(appt_id),
            Appointment.business_id == business_id,
        )
    )
    return _get_or_404(result)


# ── List ──────────────────────────────────────────────────────────────────────
@router.get("/", response_model=list[AppointmentResponse])
async def list_appointments(
    status: Optional[str] = Query(None),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    query = select(Appointment).where(Appointment.business_id == business.id)
    if status:
        try:
            query = query.where(Appointment.status == AppointmentStatus(status))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Statut invalide: {status}")
    query = query.order_by(Appointment.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


# ── Get one ───────────────────────────────────────────────────────────────────
@router.get("/{appt_id}", response_model=AppointmentResponse)
async def get_appointment(
    appt_id: str,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    return await _fetch(db, appt_id, business.id)


# ── Update ────────────────────────────────────────────────────────────────────
@router.patch("/{appt_id}", response_model=AppointmentResponse)
async def update_appointment(
    appt_id: str,
    data: AppointmentUpdate,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    appt = await _fetch(db, appt_id, business.id)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(appt, field, value)
    await db.flush()
    await db.commit()
    await db.refresh(appt)
    return appt


# ── Confirm ───────────────────────────────────────────────────────────────────
@router.post("/{appt_id}/confirm", response_model=AppointmentResponse)
async def confirm_appointment(
    appt_id: str,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    appt = await _fetch(db, appt_id, business.id)

    if appt.status != AppointmentStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail="Seuls les rendez-vous en attente peuvent être confirmés"
        )

    appt.status = AppointmentStatus.CONFIRMED
    await db.flush()
    await db.commit()
    await db.refresh(appt)

    # Send WhatsApp confirmation to customer
    if appt.customer_phone and business.evolution_instance_id:
        try:
            wa = WhatsAppService(business.evolution_instance_id)
            scheduled_str = (
                appt.scheduled_at.strftime("%A %d %B à %H:%M")
                if appt.scheduled_at else "à confirmer"
            )
            message = (
                f"✅ Bonjour {appt.customer_name or 'cher client'} !\n\n"
                f"Votre rendez-vous *{appt.service_name}* est confirmé pour le *{scheduled_str}*.\n\n"
                f"À très bientôt 😊\n— {business.name}"
            )
            await wa.send_text(appt.customer_phone, message)
        except Exception:
            pass  # Don't block if WhatsApp fails

    return appt


# ── Mark done ─────────────────────────────────────────────────────────────────
@router.post("/{appt_id}/done", response_model=AppointmentResponse)
async def mark_done(
    appt_id: str,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    appt = await _fetch(db, appt_id, business.id)

    if appt.status != AppointmentStatus.CONFIRMED:
        raise HTTPException(
            status_code=400,
            detail="Seuls les rendez-vous confirmés peuvent être marqués comme terminés"
        )

    appt.status = AppointmentStatus.DONE
    await db.flush()
    await db.commit()
    await db.refresh(appt)
    return appt


# ── Cancel ────────────────────────────────────────────────────────────────────
@router.post("/{appt_id}/cancel", response_model=AppointmentResponse)
async def cancel_appointment(
    appt_id: str,
    data: AppointmentCancel,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    appt = await _fetch(db, appt_id, business.id)

    if appt.status in (AppointmentStatus.DONE, AppointmentStatus.CANCELLED):
        raise HTTPException(
            status_code=400,
            detail="Ce rendez-vous ne peut plus être annulé"
        )

    appt.status = AppointmentStatus.CANCELLED
    if data.reason:
        appt.notes = f"{appt.notes or ''}\n[Annulé: {data.reason}]".strip()

    await db.flush()
    await db.commit()
    await db.refresh(appt)

    # Notify customer
    if appt.customer_phone and business.evolution_instance_id:
        try:
            wa = WhatsAppService(business.evolution_instance_id)
            message = (
                f"❌ Bonjour {appt.customer_name or 'cher client'},\n\n"
                f"Votre rendez-vous *{appt.service_name}* a été annulé."
                + (f"\nRaison : {data.reason}" if data.reason else "")
                + f"\n\nContactez-nous pour reprendre rendez-vous.\n— {business.name}"
            )
            await wa.send_text(appt.customer_phone, message)
        except Exception:
            pass

    return appt
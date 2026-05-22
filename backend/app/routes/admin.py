"""
backend/app/routes/admin.py
Panneau d'administration SuguAI.
Protégé par X-Admin-Key header.
"""
import logging
import httpx
import uuid
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.database import get_db
from app.config import settings
from app.models.business import Business, BusinessStatus
from app.models.customer import Customer
from app.models.order import Order, OrderStatus
from app.models.message import Message
from app.models.conversation import Conversation
from app.models.promotion import Promotion

router = APIRouter(prefix="/admin", tags=["Admin"])
logger = logging.getLogger(__name__)

PAID_STATUSES = [
    OrderStatus.PAID, OrderStatus.PROCESSING,
    OrderStatus.SHIPPED, OrderStatus.DELIVERED,
]


# ── Auth ───────────────────────────────────────────────────────────────────────
def require_admin(x_admin_key: str = Header(...)):
    if x_admin_key != settings.ADMIN_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Accès refusé")
    return True


# ── Stats globales ─────────────────────────────────────────────────────────────
@router.get("/stats")
async def admin_stats(
    _: bool = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    total_businesses = (await db.execute(
        select(func.count(Business.id))
    )).scalar() or 0

    active_businesses = (await db.execute(
        select(func.count(Business.id))
        .where(Business.whatsapp_connected == True)
    )).scalar() or 0

    suspended_businesses = (await db.execute(
        select(func.count(Business.id))
        .where(Business.is_active == False)
    )).scalar() or 0

    total_customers = (await db.execute(
        select(func.count(Customer.id))
    )).scalar() or 0

    total_orders = (await db.execute(
        select(func.count(Order.id))
    )).scalar() or 0

    total_revenue = float((await db.execute(
        select(func.sum(Order.total_amount))
        .where(Order.status.in_(PAID_STATUSES))
    )).scalar() or 0)

    total_messages = (await db.execute(
        select(func.count(Message.id))
    )).scalar() or 0

    total_promotions = (await db.execute(
        select(func.count(Promotion.id))
    )).scalar() or 0

    return {
        "total_businesses":    total_businesses,
        "active_businesses":   active_businesses,
        "suspended_businesses": suspended_businesses,
        "total_customers":     total_customers,
        "total_orders":        total_orders,
        "total_revenue":       total_revenue,
        "total_messages":      total_messages,
        "total_promotions":    total_promotions,
    }


# ── Liste des businesses ───────────────────────────────────────────────────────
@router.get("/businesses")
async def list_businesses(
    _: bool = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Business).order_by(Business.created_at.desc())
    )
    businesses = result.scalars().all()

    out = []
    for b in businesses:
        customers_count = (await db.execute(
            select(func.count(Customer.id))
            .where(Customer.business_id == b.id)
        )).scalar() or 0

        orders_count = (await db.execute(
            select(func.count(Order.id))
            .where(Order.business_id == b.id)
        )).scalar() or 0

        revenue = float((await db.execute(
            select(func.sum(Order.total_amount))
            .where(Order.business_id == b.id, Order.status.in_(PAID_STATUSES))
        )).scalar() or 0)

        out.append({
            "id":                    str(b.id),
            "name":                  b.name,
            "phone_number":          b.phone_number,
            "business_type":         b.business_type,
            "status":                b.status,
            "whatsapp_connected":    b.whatsapp_connected,
            "evolution_instance_id": b.evolution_instance_id,
            "is_active":             b.is_active,
            "created_at":            b.created_at.isoformat(),
            "customers_count":       customers_count,
            "orders_count":          orders_count,
            "revenue":               revenue,
        })

    return out


# ── Suspendre / Activer ────────────────────────────────────────────────────────
class BusinessStatusUpdate(BaseModel):
    is_active: bool


@router.patch("/businesses/{business_id}")
async def update_business(
    business_id: str,
    data: BusinessStatusUpdate,
    _: bool = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Business).where(Business.id == uuid.UUID(business_id))
    )
    business = result.scalar_one_or_none()
    if not business:
        raise HTTPException(status_code=404, detail="Business introuvable")

    business.is_active = data.is_active
    business.status = (
        BusinessStatus.CONNECTED if data.is_active
        else BusinessStatus.SUSPENDED
    )
    await db.commit()
    return {"ok": True, "is_active": business.is_active}


# ── Instance OTP — statut ──────────────────────────────────────────────────────
@router.get("/otp-instance/status")
async def otp_instance_status(_: bool = Depends(require_admin)):
    instance = getattr(settings, "OTP_EVOLUTION_INSTANCE", "").strip()
    if not instance:
        return {"configured": False, "message": "OTP_EVOLUTION_INSTANCE non configuré dans .env"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{settings.EVOLUTION_API_URL}/instance/connectionState/{instance}",
                headers={"apikey": settings.EVOLUTION_API_KEY},
            )
        if resp.status_code == 200:
            data = resp.json()
            state = data.get("instance", {}).get("state", "unknown")
            return {
                "configured": True,
                "instance":   instance,
                "state":      state,
                "connected":  state == "open",
            }
        return {"configured": True, "instance": instance, "connected": False, "error": resp.text[:200]}
    except Exception as e:
        return {"configured": True, "instance": instance, "connected": False, "error": str(e)}


# ── Instance OTP — créer ───────────────────────────────────────────────────────
@router.post("/otp-instance/create")
async def create_otp_instance(_: bool = Depends(require_admin)):
    instance = getattr(settings, "OTP_EVOLUTION_INSTANCE", "suguai-otp").strip()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{settings.EVOLUTION_API_URL}/instance/create",
                headers={"apikey": settings.EVOLUTION_API_KEY, "Content-Type": "application/json"},
                json={"instanceName": instance, "qrcode": True, "integration": "WHATSAPP-BAILEYS"},
            )
        return {"ok": resp.status_code in (200, 201), "instance": instance, "data": resp.json()}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ── Instance OTP — QR code ─────────────────────────────────────────────────────
@router.get("/otp-instance/qr")
async def get_otp_qr(_: bool = Depends(require_admin)):
    instance = getattr(settings, "OTP_EVOLUTION_INSTANCE", "suguai-otp").strip()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{settings.EVOLUTION_API_URL}/instance/connect/{instance}",
                headers={"apikey": settings.EVOLUTION_API_KEY},
            )
        if resp.status_code == 200:
            return resp.json()
        return {"error": resp.text[:200]}
    except Exception as e:
        return {"error": str(e)}
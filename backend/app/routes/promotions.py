"""
app/routes/promotions.py
─────────────────────────
WhatsApp broadcast promotions — create, send, delete.

CHANGES vs old version:
  - _broadcast() no longer receives `db` as parameter.
    CRITICAL FIX: The FastAPI session is tied to the HTTP request lifecycle and
    is closed before BackgroundTasks run. _broadcast now opens its own session
    via AsyncSessionLocal, which is safe for long-running background work.
  - Anti-spam delay added between sends (1.5–3s random jitter) to prevent
    WhatsApp from flagging the number as spam on large broadcasts.
  - WhatsAppService calls now properly awaited (send functions are now async).
"""
import uuid
import json
import asyncio
import random
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db, AsyncSessionLocal
from app.dependencies import get_current_business
from app.models.business import Business
from app.models.promotion import Promotion, PromotionStatus
from app.models.customer import Customer
from app.models.product import Product
from app.schemas.promotion import PromotionCreate, PromotionOut
from app.services.whatsapp_service import WhatsAppService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/promotions", tags=["Promotions"])


def _build_promo_message(promo: Promotion, product) -> str:
    lines = [promo.message]

    if product:
        lines.append(f"\n🛍️ *{product.name}*")
        original_price = float(product.price)
        if promo.discount_amount:
            discounted = max(original_price - float(promo.discount_amount), 0)
            lines.append(f"~~{original_price:,.0f} FCFA~~ → *{discounted:,.0f} FCFA*")
            lines.append(f"💸 Vous économisez {float(promo.discount_amount):,.0f} FCFA !")
        else:
            lines.append(f"Prix : *{original_price:,.0f} FCFA*")

    lines.append("")
    if promo.scheduled_at:
        lines.append(f"📅 *Début :* {promo.scheduled_at.strftime('%d/%m/%Y à %H:%M')}")
    if promo.expires_at:
        lines.append(f"⏰ *Valable jusqu'au :* {promo.expires_at.strftime('%d/%m/%Y à %H:%M')}")
    else:
        lines.append("⏰ *Offre limitée !*")

    lines.append("\n_Répondez à ce message pour commander avec cette offre_ 🛒")
    return "\n".join(lines)


async def _broadcast(
    promotion_id: uuid.UUID,
    business_id: uuid.UUID,
    instance_id: str,
):
    """
    Background task: send promotional message (+ photo) to chosen customers.

    IMPORTANT: This function opens its OWN database session.
    Never pass a FastAPI-scoped `db` session to BackgroundTasks — it will
    be closed before this task runs, causing DetachedInstanceError.
    """
    async with AsyncSessionLocal() as db:
        try:
            # Reload promo with product relationship
            result = await db.execute(
                select(Promotion)
                .where(Promotion.id == promotion_id)
                .options(selectinload(Promotion.product))
            )
            promo = result.scalar_one_or_none()
            if not promo:
                logger.error(f"Promotion {promotion_id} not found in _broadcast")
                return

            # Resolve recipient list
            customer_ids: List[uuid.UUID] = []
            if promo.recipient_customer_ids:
                try:
                    raw = json.loads(promo.recipient_customer_ids)
                    customer_ids = [uuid.UUID(str(cid)) for cid in raw]
                except Exception as e:
                    logger.error(f"Failed to parse recipient_customer_ids: {e}")

            if not customer_ids:
                logger.warning(f"Promotion {promotion_id}: no recipients, aborting")
                promo.status = PromotionStatus.cancelled
                await db.commit()
                return

            customers_result = await db.execute(
                select(Customer).where(
                    Customer.id.in_(customer_ids),
                    Customer.business_id == business_id,
                    Customer.is_blocked == False,
                )
            )
            customers = customers_result.scalars().all()

            promo.status = PromotionStatus.sending
            promo.recipient_count = len(customers)
            await db.commit()

            wa = WhatsAppService(instance_id)
            product   = promo.product
            text_body = _build_promo_message(promo, product)

            delivered = 0
            total     = len(customers)

            for i, customer in enumerate(customers):
                try:
                    if product and product.image_url:
                        ok = await wa.send_image(
                            to=customer.whatsapp_phone,
                            image_url=product.image_url,
                            caption=text_body,
                        )
                    else:
                        ok = await wa.send_text(
                            to=customer.whatsapp_phone,
                            text=text_body,
                        )

                    if ok:
                        delivered += 1
                        logger.info(
                            f"Promo {promotion_id}: sent to {customer.whatsapp_phone} "
                            f"({delivered}/{total})"
                        )
                    else:
                        logger.warning(
                            f"Promo {promotion_id}: send failed for {customer.whatsapp_phone}"
                        )

                except Exception as e:
                    logger.warning(
                        f"Promo {promotion_id}: exception for {customer.whatsapp_phone}: {e}"
                    )

                # ── Anti-spam delay ────────────────────────────────────────────
                # WhatsApp detects rapid bulk sends as spam.
                # 1.5–3s random jitter keeps the rate under ~30 msgs/min,
                # which is safe for a single Evolution instance.
                if i < total - 1:
                    await asyncio.sleep(random.uniform(1.5, 3.0))

            promo.delivered_count = delivered
            promo.status   = PromotionStatus.sent
            promo.sent_at  = datetime.now(timezone.utc).replace(tzinfo=None)
            await db.commit()
            logger.info(
                f"Promotion {promotion_id} completed: {delivered}/{total} delivered"
            )

        except Exception as e:
            await db.rollback()
            logger.error(f"_broadcast failed for promotion {promotion_id}: {e}", exc_info=True)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[PromotionOut])
async def list_promotions(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Promotion)
        .where(Promotion.business_id == business.id)
        .options(selectinload(Promotion.product))
        .order_by(Promotion.created_at.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=PromotionOut)
async def create_promotion(
    data: PromotionCreate,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    if data.product_id:
        prod_result = await db.execute(
            select(Product).where(
                Product.id == data.product_id,
                Product.business_id == business.id,
            )
        )
        if not prod_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Produit introuvable")

    recipient_json = None
    if data.recipient_customer_ids:
        recipient_json = json.dumps([str(cid) for cid in data.recipient_customer_ids])

    promo = Promotion(
        business_id=business.id,
        title=data.title,
        message=data.message,
        product_id=data.product_id,
        discount_amount=data.discount_amount,
        recipient_customer_ids=recipient_json,
        scheduled_at=data.scheduled_at,
        expires_at=data.expires_at,
        status=PromotionStatus.scheduled if data.scheduled_at else PromotionStatus.draft,
    )
    db.add(promo)
    await db.commit()
    await db.refresh(promo)

    result = await db.execute(
        select(Promotion)
        .where(Promotion.id == promo.id)
        .options(selectinload(Promotion.product))
    )
    return result.scalar_one()


@router.post("/{promotion_id}/send")
async def send_promotion_now(
    promotion_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Promotion).where(
            Promotion.id == promotion_id,
            Promotion.business_id == business.id,
        )
    )
    promo = result.scalar_one_or_none()
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion introuvable")
    if promo.status == PromotionStatus.sent:
        raise HTTPException(status_code=400, detail="Déjà envoyée")
    if promo.status == PromotionStatus.sending:
        raise HTTPException(status_code=400, detail="Envoi déjà en cours")
    if not business.evolution_instance_id:
        raise HTTPException(status_code=400, detail="WhatsApp non connecté")
    if not promo.recipient_customer_ids:
        raise HTTPException(status_code=400, detail="Aucun destinataire sélectionné")

    # Pass only serializable values — NOT the db session
    background_tasks.add_task(
        _broadcast,
        promo.id,
        business.id,
        business.evolution_instance_id,
        # db is intentionally NOT passed here
    )
    return {"message": "Diffusion lancée en arrière-plan"}


@router.delete("/{promotion_id}")
async def delete_promotion(
    promotion_id: uuid.UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Promotion).where(
            Promotion.id == promotion_id,
            Promotion.business_id == business.id,
        )
    )
    promo = result.scalar_one_or_none()
    if not promo:
        raise HTTPException(status_code=404, detail="Introuvable")
    if promo.status == PromotionStatus.sending:
        raise HTTPException(status_code=400, detail="Envoi en cours, impossible de supprimer")
    await db.delete(promo)
    await db.commit()
    return {"ok": True}
"""
backend/app/routes/orders.py
Handles Order management, WhatsApp confirmations, and Payment tracking.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
import uuid
import logging
from datetime import datetime

from app.database import get_db
from app.models.order import Order, OrderStatus
from app.models.business import Business
from app.schemas.order import OrderResponse, OrderStatusUpdate
from app.dependencies import get_current_business
from app.config import settings

router = APIRouter(prefix="/orders", tags=["Orders"])
logger = logging.getLogger(__name__)


# ── Shorthand: load order with all relations ──────────────────────────────────
def _order_options():
    return [
        selectinload(Order.items),
        selectinload(Order.promotion),   # ← always load promotion
    ]


# ── Confirmation messages ──────────────────────────────────────────────────────
def _confirm_message(order: Order, language: str) -> str:
    lang = (language or "french").lower()
    total = f"{float(order.total_amount):,.0f}".replace(",", ".")

    item_lines = []
    for item in order.items:
        parts = [f"{item.quantity}x {item.product_name}"]
        if item.color:
            parts.append(f"couleur: {item.color}" if lang == "french" else f"dalen: {item.color}")
        if item.size:
            parts.append(f"taille: {item.size}" if lang == "french" else f"pointure: {item.size}")
        item_lines.append(" — ".join(parts))

    items_text = "\n".join(f"• {l}" for l in item_lines)

    # Ligne promo si applicable
    promo_line = ""
    if order.promotion_discount:
        discount = f"{float(order.promotion_discount):,.0f}".replace(",", ".")
        promo_line = (
            f"\n🏷️ Réduction promo: -{discount} FCFA\n"
            if lang != "bambara"
            else f"\n🏷️ Nafama: -{discount} FCFA\n"
        )

    if lang == "bambara":
        return (
            f"Awo! I ka kɔnɔ sɔrɔra ✅\n\n"
            f"📦 {items_text}\n"
            f"{promo_line}"
            f"💰 Hakɛ bɛɛ: {total} FCFA\n\n"
            f"🚗 Chauffeur bɛ na i fe joona, Inch'Allah.\n"
            f"A bɛ i wele ka na i yɔrɔ la."
        )
    else:
        return (
            f"✅ Votre commande #{order.order_number} est confirmée !\n\n"
            f"📦 Articles:\n{items_text}\n"
            f"{promo_line}"
            f"💰 Total: {total} FCFA\n\n"
            f"🚗 Le livreur va vous contacter très bientôt, Inch'Allah !\n"
            f"Merci de votre confiance 🙏"
        )


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[OrderResponse])
async def list_orders(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order)
        .where(Order.business_id == business.id)
        .options(*_order_options())
        .order_by(Order.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: uuid.UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id, Order.business_id == business.id)
        .options(*_order_options())
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.patch("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: uuid.UUID,
    data: OrderStatusUpdate,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id, Order.business_id == business.id)
        .options(*_order_options())
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = data.status

    # Notify customer via WhatsApp
    try:
        from app.services.message_processor import send_order_status_message
        send_order_status_message(order, business)
    except Exception as e:
        logger.error(f"Status notification failed: {e}")

    await db.commit()
    await db.refresh(order)
    return OrderResponse.model_validate(order)


@router.post("/{order_id}/confirm", response_model=OrderResponse)
async def confirm_order(
    order_id: uuid.UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Confirm order & send WhatsApp message to customer."""
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id, Order.business_id == business.id)
        .options(*_order_options())
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = OrderStatus.PROCESSING
    await db.flush()

    if order.customer_phone and business.evolution_instance_id:
        try:
            from app.services import whatsapp_service
            message = _confirm_message(order, order.customer_language or "french")
            whatsapp_service.send_text_message(
                phone_number_id=business.evolution_instance_id,
                access_token=settings.EVOLUTION_API_KEY,
                to=order.customer_phone,
                text=message,
            )
        except Exception as e:
            logger.error(f"WhatsApp confirm send failed: {e}")

    await db.commit()
    await db.refresh(order)
    return OrderResponse.model_validate(order)


@router.post("/{order_id}/mark-paid", response_model=OrderResponse)
async def mark_order_as_paid(
    order_id: uuid.UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """Mark order as PAID — independent of fulfillment status."""
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id, Order.business_id == business.id)
        .options(*_order_options())
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = OrderStatus.PAID
    order.payment_verified_at = datetime.utcnow()

    await db.commit()
    await db.refresh(order)
    return OrderResponse.model_validate(order)
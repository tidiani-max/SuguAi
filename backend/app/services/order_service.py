"""
backend/app/services/order_service.py
"""
import json
import uuid
import logging
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product
from app.models.promotion import Promotion, PromotionStatus
from app.models.conversation import Conversation

logger = logging.getLogger(__name__)


async def generate_order_number(db: AsyncSession) -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    result = await db.execute(
        select(Order)
        .where(Order.order_number.like(f"ORD-{today}-%"))
        .order_by(Order.created_at.desc())
    )
    last_order = result.scalars().first()
    seq = int(last_order.order_number.split("-")[-1]) + 1 if last_order else 1
    return f"ORD-{today}-{seq:04d}"


async def get_active_promotion(
    db: AsyncSession,
    business_id: uuid.UUID,
    customer_id: uuid.UUID,
    product_id: uuid.UUID | None,
) -> Promotion | None:
    """
    Cherche une promotion active (non expirée, déjà envoyée) pour ce client
    qui concerne le produit commandé.
    Retourne None si aucune promo valide trouvée.
    """
    now = datetime.utcnow()

    result = await db.execute(
        select(Promotion).where(
            Promotion.business_id == business_id,
            Promotion.status == PromotionStatus.sent,
            Promotion.product_id == product_id,
            # Pas encore expirée (ou pas de date d'expiration)
            (Promotion.expires_at == None) | (Promotion.expires_at > now),
        )
        .order_by(Promotion.sent_at.desc())
        .limit(10)
    )
    promotions = result.scalars().all()

    # Vérifier que ce client était bien dans les destinataires
    customer_id_str = str(customer_id)
    for promo in promotions:
        if not promo.recipient_customer_ids:
            continue
        try:
            recipients = json.loads(promo.recipient_customer_ids)
            if customer_id_str in recipients:
                return promo
        except Exception:
            continue

    return None


async def create_order_from_conversation(
    db: AsyncSession,
    conversation: Conversation,
    payment_screenshot_url: str = None,
    customer_name: str = None,
    customer_phone: str = None,
    delivery_address: str = None,
    customer_language: str = "french",
) -> Order:
    """
    Crée une commande depuis le panier en conversation.
    Applique automatiquement la promotion active si disponible pour le client.
    """
    if not conversation.pending_cart:
        raise ValueError("No pending cart in conversation")

    cart_items = json.loads(conversation.pending_cart)
    total = float(conversation.pending_total or 0)

    order_number = await generate_order_number(db)

    # ── Chercher une promo active pour ce client ───────────────────────────
    applied_promotion = None
    promotion_discount = None

    # On regarde le premier produit du panier pour matcher la promo
    if cart_items:
        first_product_id = cart_items[0].get("product_id")
        if first_product_id:
            applied_promotion = await get_active_promotion(
                db=db,
                business_id=conversation.business_id,
                customer_id=conversation.customer_id,
                product_id=uuid.UUID(first_product_id),
            )

    if applied_promotion and applied_promotion.discount_amount:
        promotion_discount = float(applied_promotion.discount_amount)
        # Appliquer la réduction sur le total
        total = max(total - promotion_discount, 0)
        logger.info(
            f"Promotion '{applied_promotion.title}' applied: "
            f"-{promotion_discount} FCFA → total={total}"
        )

    order = Order(
        business_id=conversation.business_id,
        customer_id=conversation.customer_id,
        conversation_id=conversation.id,
        order_number=order_number,
        status=OrderStatus.PENDING_PAYMENT,
        total_amount=total,
        payment_screenshot_url=payment_screenshot_url,
        customer_name=customer_name,
        customer_phone=customer_phone,
        delivery_address=delivery_address,
        customer_language=customer_language or "french",
        promotion_id=applied_promotion.id if applied_promotion else None,
        promotion_discount=promotion_discount,
    )
    db.add(order)
    await db.flush()

    for item in cart_items:
        product_result = await db.execute(
            select(Product).where(Product.id == uuid.UUID(item["product_id"]))
        )
        product = product_result.scalar_one_or_none()

        if product:
            # Appliquer la réduction sur le prix unitaire si promo sur ce produit
            unit_price = float(product.price)
            if (applied_promotion
                    and applied_promotion.product_id == product.id
                    and applied_promotion.discount_amount):
                unit_price = max(unit_price - float(applied_promotion.discount_amount), 0)

            order_item = OrderItem(
                order_id=order.id,
                product_id=product.id,
                product_name=product.name,
                unit_price=unit_price,
                quantity=item["quantity"],
                subtotal=unit_price * item["quantity"],
                color=item.get("color"),
                size=item.get("size"),
            )
            db.add(order_item)
            product.stock = max(0, product.stock - item["quantity"])

    await db.flush()
    logger.info(
        f"Order {order_number} created — customer: {customer_name}, "
        f"promo: {applied_promotion.title if applied_promotion else 'none'}"
    )
    return order


async def mark_order_paid(
    db: AsyncSession,
    order: Order,
    payment_reference: str = None,
) -> Order:
    order.status = OrderStatus.PAID
    order.payment_verified_at = datetime.utcnow()
    order.payment_reference = payment_reference
    await db.flush()
    logger.info(f"Order {order.order_number} marked as PAID")
    return order
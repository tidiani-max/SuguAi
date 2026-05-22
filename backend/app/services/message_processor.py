"""
app/services/message_processor.py
───────────────────────────────────
Core AI pipeline. Handles text and vocal messages.

v5 changes:
  - Routes transport, health, education, real_estate, events to dedicated AI builders.
  - Products are reused as "services/routes/listings" for non-commerce types.
  - Order auto-creation still works for all types that emit [COMMANDE:] tags.
"""
import json
import re
import logging
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.business import Business, BusinessType
from app.models.customer import Customer
from app.models.conversation import Conversation, ConversationState
from app.models.message import Message, MessageDirection, MessageType
from app.models.product import Product
from app.services import whatsapp_service, ai_service
from app.config import settings

logger = logging.getLogger(__name__)


def get_now_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Business type groupings ────────────────────────────────────────────────────

# Types that use products as a physical catalogue + order flow
COMMERCE_TYPES = {BusinessType.PRODUCTS_SELLER}

# Types that use products as a menu + order flow
FNB_TYPES = {BusinessType.FNB}

# Types that use products as service listings + appointment/booking flow
SERVICE_CATALOGUE_TYPES = {
    BusinessType.TRANSPORT,
    BusinessType.HEALTH,
    BusinessType.EDUCATION,
    BusinessType.REAL_ESTATE,
    BusinessType.EVENTS,
}

# Types with no catalogue at all — pure info bot
INFO_TYPES = {BusinessType.SERVICE_INFORMATION, BusinessType.CUSTOM}


# ── Customer & conversation lookups ───────────────────────────────────────────

async def get_or_create_customer(
    db: AsyncSession,
    business_id: uuid.UUID,
    whatsapp_jid: str,
    raw_jid: str | None = None,
) -> Customer:
    async def _lookup(field_value: str) -> Customer | None:
        r = await db.execute(
            select(Customer)
            .where(Customer.business_id == business_id, Customer.whatsapp_phone == field_value)
            .order_by(Customer.last_seen.desc())
            .limit(1)
        )
        return r.scalars().first()

    customer = await _lookup(whatsapp_jid)

    if not customer and raw_jid and raw_jid != whatsapp_jid:
        customer = await _lookup(raw_jid)
        if customer:
            customer.whatsapp_phone = whatsapp_jid

    if not customer:
        bare = whatsapp_jid.split("@")[0]
        customer = await _lookup(bare)
        if customer:
            customer.whatsapp_phone = whatsapp_jid

    if not customer:
        customer = Customer(
            id=uuid.uuid4(),
            business_id=business_id,
            whatsapp_phone=whatsapp_jid,
            created_at=get_now_naive(),
            last_seen=get_now_naive(),
        )
        db.add(customer)
        await db.flush()
        logger.info(f"New customer: {whatsapp_jid}")
    else:
        customer.last_seen = get_now_naive()

    return customer


async def get_or_create_conversation(
    db: AsyncSession,
    business_id: uuid.UUID,
    customer_id: uuid.UUID,
) -> Conversation:
    r = await db.execute(
        select(Conversation)
        .where(
            Conversation.business_id == business_id,
            Conversation.customer_id == customer_id,
            Conversation.state != ConversationState.COMPLETED,
        )
        .order_by(Conversation.last_message_at.desc())
        .limit(1)
    )
    conv = r.scalars().first()
    if not conv:
        conv = Conversation(
            id=uuid.uuid4(),
            business_id=business_id,
            customer_id=customer_id,
            state=ConversationState.BROWSING,
            started_at=get_now_naive(),
            last_message_at=get_now_naive(),
        )
        db.add(conv)
        await db.flush()
    return conv


async def load_conversation_history(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    current_language: str = "french",
) -> list:
    from app.services.speech_service import detect_language as _detect_lang

    r = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(10)
    )
    messages = list(reversed(r.scalars().all()))

    history = [
        {
            "role": "user" if m.direction == MessageDirection.INBOUND else "assistant",
            "content": m.content or "[media]",
        }
        for m in messages
    ]

    if current_language == "french":
        return history

    last_assistant_lang = "french"
    for m in reversed(messages):
        if m.direction == MessageDirection.OUTBOUND and m.content:
            last_assistant_lang = _detect_lang(m.content)
            break

    if history and current_language != last_assistant_lang:
        switch_notes = {
            "bambara": "[NOTE INTERNE: Le client parle maintenant en Bambara. Reponds UNIQUEMENT en Bambara phonetique.]",
            "mixed":   "[NOTE INTERNE: Le client melange Bambara et Francais. Fais de meme.]",
        }
        note = switch_notes.get(current_language, "")
        if note:
            history = [
                {"role": "user",      "content": note},
                {"role": "assistant", "content": "Awo, compris."},
            ] + history

    return history


def _detect_text_language_and_intent(text: str) -> tuple[str, str]:
    from app.services.speech_service import detect_language, detect_intent
    return detect_language(text), detect_intent(text)


# ── Product loader (shared by all catalogue types) ────────────────────────────

async def _load_products(db: AsyncSession, business_id: uuid.UUID) -> list:
    res = await db.execute(
        select(Product)
        .where(Product.business_id == business_id, Product.is_active == True)
        .options(selectinload(Product.variants))
    )
    products_raw = res.scalars().all()
    return [
        {
            "id":          str(p.id),
            "name":        p.name,
            "price":       float(p.price),
            "stock":       p.stock,
            "unit":        p.unit or "pc",
            "description": getattr(p, "description", None),
            "image_url":   getattr(p, "image_url", None),
            "variants": [
                {
                    "name":      v.name,
                    "stock":     v.stock,
                    "image_url": v.image_url,
                    "color_hex": v.color_hex,
                }
                for v in p.variants if v.is_active
            ],
        }
        for p in products_raw
    ]


# ── Order detection & auto-creation ───────────────────────────────────────────

_COMMANDE_TAG_RE = re.compile(
    r"\[COMMANDE:\s*"
    r"produit=([^|]*)\|"
    r"\s*qte=([^|]*)\|"
    r"\s*couleur=([^|]*)\|"
    r"\s*taille=([^|]*)\|"
    r"\s*nom=([^|]*)\|"
    r"\s*adresse=([^|]*)\|"
    r"(?:\s*tel=([^|]*)\|)?"
    r"(?:\s*paiement=([^|]*)\|)?"
    r"\s*total=([^\]]*)\]",
    re.IGNORECASE,
)


def _parse_commande_tag(ai_reply: str) -> dict | None:
    match = _COMMANDE_TAG_RE.search(ai_reply)
    if not match:
        return None
    raw_tel = (match.group(7) or "").strip()
    return {
        "product_name":     match.group(1).strip(),
        "quantity":         int(match.group(2).strip() or "1"),
        "color":            match.group(3).strip() or None,
        "size":             match.group(4).strip() or None,
        "customer_name":    match.group(5).strip() or None,
        "delivery_address": match.group(6).strip() or None,
        "customer_tel":     raw_tel or None,
        "payment_method":   (match.group(8) or "").strip() or None,
        "total":            float(re.sub(r"[^\d.]", "", match.group(9).strip()) or "0"),
    }


async def _maybe_create_order(
    db: AsyncSession,
    conversation: Conversation,
    customer: Customer,
    ai_reply: str,
    products_data: list,
    vocal_language: str = "french",
) -> None:
    parsed = _parse_commande_tag(ai_reply)
    if not parsed:
        return

    from app.models.order import Order
    existing_r = await db.execute(
        select(Order)
        .where(Order.conversation_id == conversation.id)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
        .limit(1)
    )
    existing = existing_r.scalars().first()
    if existing:
        existing_product = existing.items[0].product_name.lower() if existing.items else ""
        new_product      = parsed["product_name"].lower()
        is_same_product  = (existing_product in new_product or new_product in existing_product)
        is_closed        = existing.status.value in ("delivered", "cancelled")

        if is_same_product and not is_closed:
            logger.info(f"Duplicate order blocked for conversation {conversation.id}")
            return

    # Match against catalogue — for non-commerce types, we just use the product name
    product_name_lower = parsed["product_name"].lower()
    matched_product = None
    for p in products_data:
        if p["name"].lower() in product_name_lower or product_name_lower in p["name"].lower():
            matched_product = p
            break

    # For appointment-type bookings (total=0), we still create the record
    # using a dummy product dict so order_service has something to work with
    if not matched_product:
        matched_product = {
            "id":    "",
            "name":  parsed["product_name"],
            "price": parsed["total"],
        }

    raw_tel = parsed.get("customer_tel") or ""
    driver_phone = customer.whatsapp_phone if (not raw_tel or raw_tel.upper() == "WHATSAPP") else raw_tel

    cart = [{
        "product_id":   str(matched_product.get("id", "")),
        "product_name": matched_product["name"],
        "quantity":     parsed["quantity"],
        "unit_price":   float(matched_product.get("price", parsed["total"])),
        "color":        parsed["color"],
        "size":         parsed["size"],
    }]

    total = parsed["total"] or float(matched_product.get("price", 0)) * parsed["quantity"]

    conversation.pending_cart  = json.dumps(cart)
    conversation.pending_total = str(total)
    await db.flush()

    from app.services.order_service import create_order_from_conversation
    try:
        order = await create_order_from_conversation(
            db,
            conversation,
            customer_name=parsed["customer_name"],
            customer_phone=driver_phone,
            delivery_address=parsed["delivery_address"],
            customer_language=vocal_language,
        )
        logger.info(
            f"Auto-created order {order.order_number} — "
            f"{parsed['product_name']} x{parsed['quantity']}, total: {total:.0f} FCFA"
        )
    except Exception as e:
        logger.error(f"Auto-order creation failed: {e}", exc_info=True)


async def _maybe_recover_order_from_history(
    db: AsyncSession,
    conversation: Conversation,
    customer: Customer,
    products_data: list,
    vocal_language: str,
) -> None:
    from app.models.order import Order

    existing_r = await db.execute(
        select(Order)
        .where(Order.conversation_id == conversation.id)
        .order_by(Order.created_at.desc())
        .limit(1)
    )
    existing = existing_r.scalars().first()
    if existing and existing.customer_name:
        return

    r = await db.execute(
        select(Message)
        .where(
            Message.conversation_id == conversation.id,
            Message.direction == MessageDirection.OUTBOUND,
        )
        .order_by(Message.created_at.asc())
    )
    messages = r.scalars().all()

    for msg in messages:
        if msg.content and "[COMMANDE:" in msg.content:
            logger.info(f"Found missed [COMMANDE:] tag in message {msg.id} — recovering order")
            await _maybe_create_order(
                db=db,
                conversation=conversation,
                customer=customer,
                ai_reply=msg.content,
                products_data=products_data,
                vocal_language=vocal_language,
            )
            return


# ── Promotion lookups ──────────────────────────────────────────────────────────

async def _get_active_promotion_for_customer(
    db, business_id, customer_id, product_ids
) -> object | None:
    if not product_ids:
        return None
    from app.models.promotion import Promotion, PromotionStatus
    now = get_now_naive()
    result = await db.execute(
        select(Promotion).where(
            Promotion.business_id == business_id,
            Promotion.status == PromotionStatus.sent,
            Promotion.product_id.in_(product_ids),
            (Promotion.expires_at == None) | (Promotion.expires_at > now),
        ).order_by(Promotion.sent_at.desc()).limit(10)
    )
    promotions = result.scalars().all()
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


async def _get_expired_promotion_for_customer(
    db, business_id, customer_id, product_ids
) -> object | None:
    if not product_ids:
        return None
    from app.models.promotion import Promotion, PromotionStatus
    now = get_now_naive()
    result = await db.execute(
        select(Promotion).where(
            Promotion.business_id == business_id,
            Promotion.status == PromotionStatus.sent,
            Promotion.product_id.in_(product_ids),
            Promotion.expires_at != None,
            Promotion.expires_at <= now,
        ).order_by(Promotion.sent_at.desc()).limit(10)
    )
    promotions = result.scalars().all()
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


# ── System prompt router ───────────────────────────────────────────────────────

async def _build_system_blocks(
    db: AsyncSession,
    business: Business,
    customer: Customer,
    language: str,
    intent: str,
    is_first_message: bool,
    is_vocal: bool,
) -> tuple[list[dict], list, object | None]:
    """
    Returns (system_blocks, products_data, active_promotion).
    products_data is empty for info-only types.
    active_promotion is None for non-commerce types.
    """
    btype = business.business_type
    products_data: list = []
    active_promotion = None

    common_kwargs = dict(
        ai_tone=business.ai_tone or "professional",
        is_vocal=is_vocal,
        language=language,
        intent=intent,
        is_first_message=is_first_message,
    )

    # ── PRODUCTS SELLER ────────────────────────────────────────────────────────
    if btype == BusinessType.PRODUCTS_SELLER:
        products_data = await _load_products(db, business.id)
        product_ids   = [uuid.UUID(p["id"]) for p in products_data if p["id"]]

        promo = await _get_active_promotion_for_customer(
            db, business.id, customer.id, product_ids
        )
        is_expired = False
        if not promo:
            promo = await _get_expired_promotion_for_customer(
                db, business.id, customer.id, product_ids
            )
            if promo:
                is_expired = True

        if promo:
            promo_product = next(
                (p for p in products_data if uuid.UUID(p["id"]) == promo.product_id), None
            )
            if promo_product:
                discounted = max(promo_product["price"] - float(promo.discount_amount or 0), 0)
                active_promotion = {
                    "product_name":     promo_product["name"],
                    "original_price":   promo_product["price"],
                    "discount_amount":  float(promo.discount_amount or 0),
                    "discounted_price": discounted,
                    "expires_at":       promo.expires_at.strftime("%d/%m/%Y à %H:%M") if promo.expires_at else None,
                    "is_expired":       is_expired,
                }

        blocks = ai_service.build_product_seller_system_prompt(
            business_name=business.name,
            products=products_data,
            payment_instructions=business.payment_instructions,
            active_promotion=active_promotion,
            **common_kwargs,
        )

    # ── FNB ────────────────────────────────────────────────────────────────────
    elif btype == BusinessType.FNB:
        products_data = await _load_products(db, business.id)
        blocks = ai_service.build_fnb_system_prompt(
            business_name=business.name,
            products=products_data,
            payment_instructions=business.payment_instructions,
            description=business.description or "",
            faq=business.faq or "",
            **common_kwargs,
        )

    # ── TRANSPORT ──────────────────────────────────────────────────────────────
    elif btype == BusinessType.TRANSPORT:
        products_data = await _load_products(db, business.id)
        blocks = ai_service.build_transport_system_prompt(
            business_name=business.name,
            routes=products_data,
            payment_instructions=business.payment_instructions or "",
            description=business.description or "",
            faq=business.faq or "",
            **common_kwargs,
        )

    # ── HEALTH ─────────────────────────────────────────────────────────────────
    elif btype == BusinessType.HEALTH:
        products_data = await _load_products(db, business.id)
        blocks = ai_service.build_health_system_prompt(
            business_name=business.name,
            services=products_data,
            payment_instructions=business.payment_instructions or "",
            description=business.description or "",
            faq=business.faq or "",
            **common_kwargs,
        )

    # ── EDUCATION ──────────────────────────────────────────────────────────────
    elif btype == BusinessType.EDUCATION:
        products_data = await _load_products(db, business.id)
        blocks = ai_service.build_education_system_prompt(
            business_name=business.name,
            courses=products_data,
            payment_instructions=business.payment_instructions or "",
            description=business.description or "",
            faq=business.faq or "",
            **common_kwargs,
        )

    # ── REAL ESTATE ────────────────────────────────────────────────────────────
    elif btype == BusinessType.REAL_ESTATE:
        products_data = await _load_products(db, business.id)
        blocks = ai_service.build_real_estate_system_prompt(
            business_name=business.name,
            listings=products_data,
            payment_instructions=business.payment_instructions or "",
            description=business.description or "",
            faq=business.faq or "",
            **common_kwargs,
        )

    # ── EVENTS ─────────────────────────────────────────────────────────────────
    elif btype == BusinessType.EVENTS:
        products_data = await _load_products(db, business.id)
        blocks = ai_service.build_events_system_prompt(
            business_name=business.name,
            services=products_data,
            payment_instructions=business.payment_instructions or "",
            description=business.description or "",
            faq=business.faq or "",
            **common_kwargs,
        )

    # ── SERVICE_INFORMATION + CUSTOM (info-only) ───────────────────────────────
    else:
        blocks = ai_service.build_information_business_system_prompt(
            business_name=business.name,
            description=business.description or "",
            faq=business.faq or "",
            **common_kwargs,
        )

    return blocks, products_data, active_promotion


# ── Main pipeline ──────────────────────────────────────────────────────────────

async def process_text_message(
    db: AsyncSession,
    business: Business,
    conversation: Conversation,
    customer: Customer,
    text: str,
    whatsapp_message_id: str,
    is_vocal: bool = False,
    vocal_language: str = "french",
    vocal_intent: str = "general",
) -> None:
    if not is_vocal:
        vocal_language, vocal_intent = _detect_text_language_and_intent(text)
        logger.info(
            f"Text lang={vocal_language} | intent={vocal_intent} | preview='{text[:60]}'"
        )

    db.add(Message(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        direction=MessageDirection.INBOUND,
        message_type=MessageType.AUDIO if is_vocal else MessageType.TEXT,
        content=text,
        whatsapp_message_id=whatsapp_message_id,
        created_at=get_now_naive(),
    ))
    conversation.last_message_at = get_now_naive()

    if not conversation.ai_enabled:
        logger.info(f"AI disabled for conversation {conversation.id} — skipping reply")
        return

    history          = await load_conversation_history(db, conversation.id, current_language=vocal_language)
    is_first_message = len(history) == 0

    system_blocks, products_data, active_promotion = await _build_system_blocks(
        db=db,
        business=business,
        customer=customer,
        language=vocal_language,
        intent=vocal_intent,
        is_first_message=is_first_message,
        is_vocal=is_vocal,
    )

    raw_reply = ai_service.get_ai_reply(
        system_blocks=system_blocks,
        conversation_history=history,
        new_message=text,
        is_vocal=is_vocal,
    )
    has_commande = "[COMMANDE:" in raw_reply
    logger.info(f"Raw reply has_commande={has_commande}: '{raw_reply[:300]}'")

    ai_reply = re.sub(r"\[COMMANDE:[^\]]+\]", "", ai_service.clean_product_tag(raw_reply)).strip()

    # ── Send product image (only for commerce / fnb types) ────────────────
    photo_sent = False
    if business.business_type in (BusinessType.PRODUCTS_SELLER, BusinessType.FNB):
        photo_keywords = [
            "photo", "image", "voir", "montre", "envoie", "envoyer",
            "picture", "pic", "foto", "wolobali",
        ]
        user_wants_photo = any(kw in text.lower() for kw in photo_keywords)

        if user_wants_photo and products_data:
            mentioned = ai_service.extract_mentioned_product(raw_reply, products_data)

            if not mentioned:
                for p in products_data:
                    if p["name"].lower() in text.lower():
                        mentioned = p
                        break

            if not mentioned and history:
                all_history_text = " ".join(m.get("content", "") for m in history).lower()
                for p in products_data:
                    if p["name"].lower() in all_history_text:
                        mentioned = p
                        break

            if not mentioned and len(products_data) == 1:
                mentioned = products_data[0]

            if mentioned:
                image_url = mentioned.get("image_url")
                if image_url and image_url.startswith("http://localhost"):
                    image_url = None

                if image_url:
                    price_fmt = f"{mentioned['price']:,.0f}".replace(",", ".")
                    caption   = (
                        f"📸 {mentioned['name']}\n"
                        f"Prix: {price_fmt} FCFA / {mentioned.get('unit', 'pc')}\n"
                        f"Stock: {mentioned.get('stock', 0)} {mentioned.get('unit', 'pc')} disponible"
                    )
                    try:
                        img_resp = await whatsapp_service.send_image_message(
                            phone_number_id=business.evolution_instance_id,
                            access_token=settings.EVOLUTION_API_KEY,
                            to=customer.whatsapp_phone,
                            image_url=image_url,
                            caption=caption,
                        )
                        if img_resp and img_resp.status_code < 400:
                            photo_sent = True
                        else:
                            photo_sent = await _send_image_direct(
                                instance_name=business.evolution_instance_id,
                                to=customer.whatsapp_phone,
                                image_url=image_url,
                                caption=caption,
                            )
                    except Exception as e:
                        logger.error(f"Image send exception: {e}")
                        photo_sent = await _send_image_direct(
                            instance_name=business.evolution_instance_id,
                            to=customer.whatsapp_phone,
                            image_url=image_url,
                            caption=caption,
                        )
                else:
                    lang = vocal_language
                    no_photo_msg = (
                        f"Ayi, {mentioned['name']} fɔtɔ tɛ an bolo sisan."
                        if lang == "bambara"
                        else f"Désolé, pas encore de photo pour {mentioned['name']}. Prix: {mentioned['price']:,.0f} FCFA. Inch'Allah on en ajoute bientôt !"
                    )
                    await whatsapp_service.send_text_message(
                        phone_number_id=business.evolution_instance_id,
                        access_token=settings.EVOLUTION_API_KEY,
                        to=customer.whatsapp_phone,
                        text=no_photo_msg,
                    )
                    photo_sent = True

    # ── Auto-create order/booking for any type that emits [COMMANDE:] ─────
    if has_commande:
        await _maybe_create_order(
            db=db,
            conversation=conversation,
            customer=customer,
            ai_reply=raw_reply,
            products_data=products_data,
            vocal_language=vocal_language,
        )
    elif business.business_type in (BusinessType.PRODUCTS_SELLER, BusinessType.FNB):
        await _maybe_recover_order_from_history(
            db=db,
            conversation=conversation,
            customer=customer,
            products_data=products_data,
            vocal_language=vocal_language,
        )

    # ── Deliver reply ──────────────────────────────────────────────────────
    delivered_as_audio = False

    if is_vocal:
        delivered_as_audio = await _deliver_vocal(
            business=business,
            customer=customer,
            ai_reply=ai_reply,
            language=vocal_language,
        )

    if not delivered_as_audio:
        await whatsapp_service.send_text_message(
            phone_number_id=business.evolution_instance_id,
            access_token=settings.EVOLUTION_API_KEY,
            to=customer.whatsapp_phone,
            text=ai_reply,
        )

    db.add(Message(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        direction=MessageDirection.OUTBOUND,
        message_type=MessageType.AUDIO if delivered_as_audio else MessageType.TEXT,
        content=raw_reply,
        created_at=get_now_naive(),
    ))

    logger.info(
        f"[{business.name}] ({business.business_type.value}) → {customer.whatsapp_phone} | "
        f"{'audio' if delivered_as_audio else 'text'} | lang={vocal_language} | "
        f"intent={vocal_intent} | first={is_first_message}"
    )


async def _deliver_vocal(
    business: Business,
    customer: Customer,
    ai_reply: str,
    language: str,
) -> bool:
    import asyncio
    try:
        from app.services.speech_service import synthesize
        try:
            data_uri = await asyncio.wait_for(
                asyncio.to_thread(synthesize, ai_reply, language),
                timeout=60.0,
            )
        except asyncio.TimeoutError:
            logger.warning(f"TTS timed out for {customer.whatsapp_phone}")
            return False

        success = await whatsapp_service.send_audio_message(
            phone_number_id=business.evolution_instance_id,
            to=customer.whatsapp_phone,
            audio_data_uri=data_uri,
        )
        return success
    except Exception as e:
        logger.error(f"TTS/audio delivery failed: {e}")
        return False


async def _send_image_direct(
    instance_name: str,
    to: str,
    image_url: str,
    caption: str = "",
) -> bool:
    import httpx as _httpx
    url = f"{settings.EVOLUTION_API_URL}/message/sendMedia/{instance_name}"
    payload = {
        "number":    to,
        "mediatype": "image",
        "mimetype":  "image/jpeg",
        "media":     image_url,
        "caption":   caption,
    }
    try:
        async with _httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url, json=payload,
                headers={"apikey": settings.EVOLUTION_API_KEY, "Content-Type": "application/json"},
            )
            return resp.status_code < 400
    except Exception as e:
        logger.error(f"Direct image send exception: {e}")
        return False


# ── Status-change WhatsApp notification ───────────────────────────────────────

_STATUS_MESSAGES: dict[str, dict[str, str]] = {
    "paid": {
        "french":  "✅ Votre paiement pour la commande #{order_number} a été confirmé ! Nous préparons votre commande, Inch'Allah.",
        "bambara": "✅ I ka waribɔ sɔrɔra #{order_number} kama! An bɛ i ka fɛn labɛn, Inch'Allah.",
    },
    "processing": {
        "french":  "🔧 Votre commande #{order_number} est en cours de préparation. Nous vous préviendrons dès qu'elle sera prête !",
        "bambara": "🔧 I ka kɔnɔ #{order_number} bɛ labɛnni la!",
    },
    "shipped": {
        "french":  "🚗 Votre commande #{order_number} est en route ! Le livreur arrive bientôt, Inch'Allah.",
        "bambara": "🚗 I ka kɔnɔ #{order_number} bɛ na! Chauffeur bɛ na i fe joona, Inch'Allah.",
    },
    "delivered": {
        "french":  "📦 Votre commande #{order_number} a été livrée ! Merci pour votre confiance 🙏",
        "bambara": "📦 I ka kɔnɔ #{order_number} sɔrɔra! I ni baara. Segin bɛ na ! 🙏",
    },
    "cancelled": {
        "french":  "❌ Votre commande #{order_number} a été annulée. Contactez-nous si vous avez des questions.",
        "bambara": "❌ I ka kɔnɔ #{order_number} banna. An wele ni aw ɲininkali b'aw la.",
    },
}


async def send_order_status_message(order, business) -> bool:
    template = _STATUS_MESSAGES.get(
        order.status if isinstance(order.status, str) else order.status.value
    )
    if not template:
        return False

    phone = order.customer_phone
    if not phone or not business.evolution_instance_id:
        return False

    lang = (order.customer_language or "french").lower()
    text = (template.get(lang) or template["french"]).replace("{order_number}", order.order_number)

    try:
        await whatsapp_service.send_text_message(
            phone_number_id=business.evolution_instance_id,
            access_token=settings.EVOLUTION_API_KEY,
            to=phone,
            text=text,
        )
        logger.info(f"Status message sent to {phone}: {order.status} (lang={lang})")
        return True
    except Exception as e:
        logger.error(f"Failed to send status message to {phone}: {e}")
        return False
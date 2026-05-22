"""
app/routes/webhook.py
──────────────────────
Evolution API v2.3.7 webhook receiver — fully multi-tenant.

KEY POINTS:
  - Secret check: only rejects if BOTH a secret is configured AND the header
    is present but wrong. Evolution API never sends X-Webhook-Secret by default,
    so no legitimate QR/message event is ever blocked.
  - Every event is routed by `instance` name → looked up in DB to find the
    correct Business. Billions of businesses work in parallel — each has its
    own Evolution instance named "biz-<first8ofUUID>".
  - QR codes are stored in Redis keyed by instance name (TTL 5 min).
  - Audio voice notes are decrypted via Evolution's getBase64FromMediaMessage.
"""
import logging
import base64
import httpx
from fastapi import APIRouter, Request, BackgroundTasks, Response
from sqlalchemy import select
from app.database import AsyncSessionLocal as SessionLocal
from app.models.business import Business
from app.services.message_processor import (
    get_or_create_customer,
    get_or_create_conversation,
    process_text_message,
)
from app.redis_client import redis_set, redis_get
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

EVOLUTION_BASE = settings.EVOLUTION_API_URL
EVOLUTION_KEY  = settings.EVOLUTION_API_KEY
WEBHOOK_SECRET = settings.META_VERIFY_TOKEN   # optional — only enforced if Evolution sends the header too

QR_TTL_SECONDS = 300   # QR codes expire after 5 minutes


# ── Utilities ──────────────────────────────────────────────────────────────────

def _headers() -> dict:
    return {"apikey": EVOLUTION_KEY, "Content-Type": "application/json"}


def normalize_jid(raw: str) -> str:
    """Canonical JID: strip :N device suffix; bare numbers get @s.whatsapp.net."""
    if not raw:
        return raw
    if "@" in raw:
        local, domain = raw.rsplit("@", 1)
        return f"{local.split(':')[0]}@{domain}"
    return f"{raw}@s.whatsapp.net"


def _extract_qr(data: dict) -> str | None:
    qrcode = data.get("qrcode")
    if isinstance(qrcode, dict) and qrcode.get("base64"):
        return qrcode["base64"]
    return data.get("base64") or None


async def _download_media_decrypted(instance_name: str, message_key: dict) -> bytes | None:
    """
    Download + decrypt WhatsApp audio via Evolution API.
    Evolution's /chat/getBase64FromMediaMessage handles AES decryption transparently.
    """
    url = f"{EVOLUTION_BASE}/chat/getBase64FromMediaMessage/{instance_name}"
    payload = {"message": {"key": message_key}, "convertToMp4": False}
    try:
        async with httpx.AsyncClient(timeout=30, headers=_headers()) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            b64 = data.get("base64") or data.get("data", {}).get("base64")
            if not b64:
                logger.error(f"Evolution media response missing base64: {data}")
                return None
            if "," in b64:
                b64 = b64.split(",", 1)[1]
            audio_bytes = base64.b64decode(b64)
            logger.info(f"Decrypted audio via Evolution: {len(audio_bytes)} bytes")
            return audio_bytes
    except httpx.HTTPStatusError as e:
        logger.error(f"Evolution getBase64FromMediaMessage failed ({e.response.status_code}): {e.response.text[:200]}")
        return None
    except Exception as e:
        logger.error(f"Media decryption failed: {e}")
        return None


# ── JID resolution ─────────────────────────────────────────────────────────────

async def resolve_lid(instance_name: str, lid: str, push_name: str | None) -> str | None:
    if not push_name or push_name == lid.split("@")[0]:
        return None
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.post(
                f"{EVOLUTION_BASE}/chat/findContacts/{instance_name}",
                headers=_headers(),
                json={"where": {"pushName": push_name}},
            )
            if resp.status_code != 200:
                return None
            phone_contacts = [c for c in resp.json() if "@s.whatsapp.net" in c.get("id", "")]
            if not phone_contacts:
                return None
            if len(phone_contacts) == 1:
                jid = normalize_jid(phone_contacts[0]["id"])
                logger.info(f"@lid resolved: {lid} → {jid}")
                return jid
            for c in phone_contacts:
                cjid = normalize_jid(c["id"])
                try:
                    async with httpx.AsyncClient(timeout=5) as c2:
                        r = await c2.post(
                            f"{EVOLUTION_BASE}/chat/findMessages/{instance_name}",
                            headers=_headers(),
                            json={"where": {"remoteJid": cjid, "fromMe": False}},
                        )
                        if r.status_code == 200:
                            msgs = r.json()
                            recs = msgs if isinstance(msgs, list) else msgs.get("messages", {}).get("records", [])
                            if recs:
                                logger.info(f"@lid disambiguated: {lid} → {cjid}")
                                return cjid
                except Exception:
                    pass
            fallback = normalize_jid(phone_contacts[0]["id"])
            logger.warning(f"@lid ambiguous, using: {lid} → {fallback}")
            return fallback
    except Exception as e:
        logger.error(f"LID resolution error: {e}")
        return None


async def resolve_jid(instance_name: str, raw_jid: str, push_name: str | None) -> tuple[str | None, str]:
    if not raw_jid:
        return None, raw_jid
    norm = normalize_jid(raw_jid)
    domain = norm.split("@")[1] if "@" in norm else ""
    if domain == "s.whatsapp.net":
        return norm, raw_jid
    if domain == "g.us":
        return None, raw_jid   # group messages — ignored
    if domain == "lid":
        resolved = await resolve_lid(instance_name, norm, push_name)
        return (resolved or norm), norm
    logger.warning(f"Unknown JID domain '{domain}': {raw_jid}")
    return None, raw_jid


# ── HTTP endpoints ─────────────────────────────────────────────────────────────

@router.get("/webhook/qr/{instance_name}")
async def get_qr_for_instance(instance_name: str):
    qr = await redis_get(f"qr:{instance_name}")
    return {"qr_code": qr, "ready": bool(qr)}


@router.post("/webhook")
async def webhook_receiver(request: Request, background_tasks: BackgroundTasks):
    """
    Central webhook receiver for ALL businesses / Evolution instances.

    Secret check logic:
      - If WEBHOOK_SECRET is set AND the request sends X-Webhook-Secret
        AND it doesn't match → reject (someone is probing with a wrong key).
      - If the header is absent (Evolution default) → always allow.
      - This means legitimate Evolution events always pass through.
    """
    incoming_secret = request.headers.get("X-Webhook-Secret", "")
    if WEBHOOK_SECRET and incoming_secret and incoming_secret != WEBHOOK_SECRET:
        client_ip = request.client.host if request.client else "unknown"
        logger.warning(f"Webhook rejected — bad secret from {client_ip}")
        return Response(status_code=403)

    try:
        body  = await request.json()
        event = body.get("event", "")

        # ── QR code event ──────────────────────────────────────────────────
        if event in ("qrcode.updated", "QRCODE_UPDATED"):
            instance = body.get("instance")
            qr = _extract_qr(body.get("data", {}))
            if instance and qr:
                await redis_set(f"qr:{instance}", qr, ttl_seconds=QR_TTL_SECONDS)
                logger.info(f"QR stored in Redis for '{instance}'")
            return {"status": "ok"}

        # ── Connection state update ────────────────────────────────────────
        if event in ("connection.update", "CONNECTION_UPDATE"):
            # Nothing to do here — the WebSocket stream polls connectionState directly.
            return {"status": "ok"}

        # ── New message ────────────────────────────────────────────────────
        if event != "messages.upsert":
            logger.debug(f"Event '{event}' ignored")
            return {"status": "ignored"}

        background_tasks.add_task(process_webhook_data, body)
        return {"status": "received"}

    except Exception as e:
        logger.error(f"Webhook parse error: {e}", exc_info=True)
        return {"status": "error"}


# ── Core message processing (runs in background per message) ───────────────────

async def process_webhook_data(body: dict):
    """
    Routes an incoming WhatsApp message to the correct Business and
    triggers AI reply. Each business is isolated — their settings,
    products, tone, FAQ, and payment instructions are all per-business.
    """
    async with SessionLocal() as db:
        try:
            data = body.get("data", {})
            key  = data.get("key", {})

            # 1. Ignore outbound messages (fromMe = messages we sent)
            if key.get("fromMe") is True:
                return

            # 2. Find the business by Evolution instance name
            #    This is the multi-tenant routing: each instance = one business.
            instance_name = body.get("instance")
            if not instance_name:
                logger.warning("Webhook body missing 'instance' field — dropped")
                return

            res = await db.execute(
                select(Business).where(Business.evolution_instance_id == instance_name)
            )
            business = res.scalars().first()
            if not business:
                logger.warning(f"No business found for instance '{instance_name}' — dropped")
                return
            if not business.is_active:
                logger.info(f"Business '{business.name}' is inactive — dropped")
                return

            # 3. Resolve customer JID (handles @lid, @s.whatsapp.net, groups)
            raw_remote = key.get("remoteJid", "")
            push_name  = data.get("pushName")
            customer_jid, raw_jid = await resolve_jid(instance_name, raw_remote, push_name)
            if not customer_jid:
                logger.warning(f"[{business.name}] Dropping — unresolvable JID: '{raw_remote}'")
                return

            # 4. Anti-loop: ignore messages from the business's own WhatsApp number
            biz_local = (business.whatsapp_business_phone or "").split("@")[0].split(":")[0].lstrip("+")
            cust_local = customer_jid.split("@")[0].lstrip("+")
            if cust_local and biz_local and cust_local == biz_local:
                logger.debug(f"[{business.name}] Ignoring own message from {customer_jid}")
                return

            # 5. Determine message type and extract text
            msg_obj      = data.get("message", {})
            message_type = data.get("messageType", "")
            is_vocal     = message_type == "audioMessage"
            text         = None
            vocal_language = "french"
            vocal_intent   = "general"

            if is_vocal:
                audio_bytes = await _download_media_decrypted(instance_name, key)
                if not audio_bytes:
                    logger.warning(f"[{business.name}] Could not decrypt audio — skipping")
                    return
                try:
                    from app.services.speech_service import transcribe
                    result         = transcribe(audio_bytes, mime_type="audio/ogg")
                    text           = result["text"]
                    vocal_language = result["language"]
                    vocal_intent   = result["intent"]
                    logger.info(f"[{business.name}] Voice transcribed: '{text[:60]}' lang={vocal_language}")
                except (ValueError, RuntimeError) as e:
                    logger.warning(f"[{business.name}] Transcription failed: {e} — skipping")
                    return
            else:
                text = (
                    msg_obj.get("conversation")
                    or msg_obj.get("extendedTextMessage", {}).get("text")
                )

            if not text:
                return

            # 6. Get or create customer + conversation, then process with AI
            #    process_text_message reads business.ai_tone, business.description,
            #    business.faq, business.payment_instructions — all per-business.
            customer     = await get_or_create_customer(db, business.id, customer_jid, raw_jid)
            conversation = await get_or_create_conversation(db, business.id, customer.id)
            await process_text_message(
                db, business, conversation, customer, text, key.get("id"),
                is_vocal=is_vocal,
                vocal_language=vocal_language,
                vocal_intent=vocal_intent,
            )

            await db.commit()
            logger.info(
                f"[{business.name}] ✅ Processed {'vocal' if is_vocal else 'text'} "
                f"from {customer_jid}"
            )

        except Exception as e:
            await db.rollback()
            logger.error(f"WEBHOOK ERROR for instance '{body.get('instance')}': {e}", exc_info=True)
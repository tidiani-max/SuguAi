"""
app/services/otp_service.py
────────────────────────────
OTP generation, verification, and WhatsApp delivery via DBuddyZ.

CHANGES vs old version:
  - Storage migrated from _otp_store dict → Redis (TTL-based, survives restarts,
    works across multiple Railway workers/instances).
  - All store functions are now async.
  - Brute-force protection: max 5 wrong attempts before OTP is invalidated.
  - Phone normalization preserved (get_clean_phone + _to_e164).
  - DBuddyZ endpoint + payload preserved exactly (POST to dbuddyz.prismswift.com).
"""
import random
import logging
import httpx
from app.config import settings
from app.redis_client import redis_set, redis_get, redis_delete, redis_incr

logger = logging.getLogger(__name__)

OTP_TTL_SECONDS      = 300   # 5 minutes — OTP expires
VERIFIED_TTL_SECONDS = 600   # 10 minutes — verified flag survives form fill
MAX_ATTEMPTS         = 5     # brute-force protection


# ── Phone normalization (unchanged from original) ──────────────────────────────

def get_clean_phone(phone: str) -> str:
    """Strip everything except digits."""
    return "".join(filter(str.isdigit, phone))


def _to_e164(phone: str) -> str:
    """
    Return phone in E.164 format with '+' (e.g. '+22370123456').
    DBuddyZ requires this format — tonumber="+9190XXXXXXXX".
    """
    digits = get_clean_phone(phone)
    if digits.startswith("00"):
        digits = digits[2:]
    return f"+{digits}"


# ── Redis key helpers ──────────────────────────────────────────────────────────

def _otp_key(phone: str) -> str:
    return f"otp:code:{get_clean_phone(phone)}"

def _attempts_key(phone: str) -> str:
    return f"otp:attempts:{get_clean_phone(phone)}"

def _verified_key(phone: str) -> str:
    return f"otp:verified:{get_clean_phone(phone)}"


# ── OTP store helpers (now async + Redis-backed) ───────────────────────────────

async def generate_otp(phone: str) -> str:
    """Generate a 6-digit OTP and store it in Redis with 5-minute TTL."""
    code = str(random.randint(100_000, 999_999))
    await redis_set(_otp_key(phone), code, ttl_seconds=OTP_TTL_SECONDS)
    await redis_delete(_attempts_key(phone))   # reset attempt counter on fresh OTP
    logger.info(f"OTP generated for {get_clean_phone(phone)}")
    return code


async def verify_otp(phone: str, code: str) -> bool:
    """
    Verify the OTP. Returns True on success.
    - On success: stores verified flag in Redis, deletes OTP.
    - On failure: increments attempt counter; invalidates OTP after MAX_ATTEMPTS.
    """
    stored = await redis_get(_otp_key(phone))
    if not stored:
        logger.warning(f"OTP verify failed for {get_clean_phone(phone)}: not found (expired or never sent)")
        return False

    attempts = await redis_incr(_attempts_key(phone), ttl_seconds=OTP_TTL_SECONDS)
    if attempts > MAX_ATTEMPTS:
        await redis_delete(_otp_key(phone))
        await redis_delete(_attempts_key(phone))
        logger.warning(
            f"OTP brute-force protection triggered for {get_clean_phone(phone)} "
            f"after {attempts} attempts — OTP invalidated"
        )
        return False

    if stored != code.strip():
        logger.warning(
            f"OTP wrong code for {get_clean_phone(phone)} "
            f"(attempt {attempts}/{MAX_ATTEMPTS})"
        )
        return False

    # ── Success ────────────────────────────────────────────────────────────
    await redis_set(_verified_key(phone), "1", ttl_seconds=VERIFIED_TTL_SECONDS)
    await redis_delete(_otp_key(phone))
    await redis_delete(_attempts_key(phone))
    logger.info(f"OTP verified successfully for {get_clean_phone(phone)}")
    return True


async def is_phone_verified(phone: str) -> bool:
    """Return True if this phone successfully passed OTP verification."""
    val = await redis_get(_verified_key(phone))
    return val == "1"


async def clear_otp(phone: str) -> None:
    """Remove all OTP-related Redis keys after successful registration."""
    await redis_delete(_otp_key(phone))
    await redis_delete(_attempts_key(phone))
    await redis_delete(_verified_key(phone))
    logger.info(f"OTP state cleared for {get_clean_phone(phone)}")


# ── DBuddyZ sender (sync — run via asyncio.to_thread in caller) ───────────────
def send_otp_whatsapp(phone: str, code: str) -> bool:
    """
    Envoie l'OTP via Evolution API (WhatsApp SuguAI).
    Utilise l'instance dédiée OTP_EVOLUTION_INSTANCE configurée dans .env.
    Fallback : log le code si instance non configurée (dev).
    """
    instance = getattr(settings, "OTP_EVOLUTION_INSTANCE", "").strip()

    if not instance:
        logger.warning(
            f"[OTP] OTP_EVOLUTION_INSTANCE non configuré. "
            f"Code pour {get_clean_phone(phone)}: {code} (dev fallback)"
        )
        return True  # ne pas bloquer l'inscription

    e164 = _to_e164(phone)
    message = (
        f"👋 *SuguAI* — Votre code de vérification :\n\n"
        f"*{code}*\n\n"
        f"⏰ Valable 5 minutes. Ne le partagez pas."
    )

    logger.info(f"[OTP WhatsApp] Envoi vers {e164} via instance '{instance}'")

    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(
                f"{settings.EVOLUTION_API_URL}/message/sendText/{instance}",
                headers={
                    "apikey": settings.EVOLUTION_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "number": e164,
                    "text": message,
                    "options": {"delay": 1000},
                },
            )

        logger.info(f"[OTP WhatsApp] Status: {resp.status_code} | {e164}")

        if resp.status_code >= 400:
            logger.error(f"[OTP WhatsApp] Échec {resp.status_code}: {resp.text[:200]}")
            return False

        logger.info(f"[OTP WhatsApp] Envoyé avec succès vers {e164}")
        return True

    except httpx.RequestError as exc:
        logger.error(f"[OTP WhatsApp] Erreur réseau: {exc}")
        return False
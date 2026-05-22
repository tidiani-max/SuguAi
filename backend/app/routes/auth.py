"""
app/routes/auth.py — WhatsApp OTP registration + JWT auth + QR connect

Multi-tenant design:
  - Every business gets its own Evolution instance: "biz-<first8ofUUID>"
  - QR connect creates/recreates only THAT business's instance
  - Webhook is set on that instance pointing to /webhook (shared receiver)
  - The shared receiver routes by instance name → Business record
  - Disconnect only deletes that business's instance, never affects others

Registration flow:
  1. POST /auth/send-otp      { phone_number }        → sends OTP via DBuddyZ
  2. POST /auth/verify-otp    { phone_number, code }   → marks phone verified in Redis
  3. POST /auth/register      { ...full form... }      → checks verified, creates account

Login: phone + password → JWT
"""
import asyncio
import hashlib
import base64
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import bcrypt
import httpx
from jose import jwt
from pydantic import BaseModel

from app.database import get_db
from app.models.business import Business, BusinessStatus
from app.schemas.business import (
    BusinessCreate, BusinessLogin, BusinessResponse,
    TokenResponse, BusinessUpdate,
)
from app.dependencies import create_access_token, get_current_business
from app.config import settings
from app.services.otp_service import (
    generate_otp, verify_otp, is_phone_verified,
    clear_otp, send_otp_whatsapp,
)
from app.redis_client import get_redis, redis_get, redis_delete

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)

EVOLUTION_BASE = settings.EVOLUTION_API_URL
EVOLUTION_KEY  = settings.EVOLUTION_API_KEY


# ── Helpers ────────────────────────────────────────────────────────────────────

def _normalize_phone(phone: str) -> str:
    phone = phone.strip()
    return phone if phone.startswith("+") else "+" + phone


def _prehash(password: str) -> bytes:
    return base64.b64encode(hashlib.sha256(password.encode("utf-8")).digest())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_prehash(password), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        if bcrypt.checkpw(_prehash(password), hashed.encode("utf-8")):
            return True
    except Exception:
        pass
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _evolution_headers() -> dict:
    return {"apikey": EVOLUTION_KEY, "Content-Type": "application/json"}


def _instance_name(business_id) -> str:
    """Deterministic, unique instance name per business. Never collides."""
    return f"biz-{str(business_id)[:8]}"


async def _delete_instance(client: httpx.AsyncClient, instance_name: str):
    """
    Best-effort cleanup of an Evolution instance.
    Logs errors but never raises — caller should not fail if Evolution is down.
    """
    for path in (f"/instance/logout/{instance_name}", f"/instance/delete/{instance_name}"):
        try:
            r = await client.delete(f"{EVOLUTION_BASE}{path}", headers=_evolution_headers())
            logger.info(f"[CLEANUP] {path} → {r.status_code}")
        except Exception as e:
            logger.warning(f"[CLEANUP] {path} failed: {e}")


async def _set_webhook_for_instance(client: httpx.AsyncClient, instance_name: str):
    """
    Register our shared /webhook endpoint on this instance.
    Called after every instance create so the webhook is always fresh.
    """
    wh_resp = await client.post(
        f"{EVOLUTION_BASE}/webhook/set/{instance_name}",
        headers=_evolution_headers(),
        json={
            "webhook": {
                "enabled": True,
                "url": f"{settings.BACKEND_URL}/webhook",
                "webhookByEvents": False,
                "webhookBase64": False,
                # We need QR updates + connection state + messages
                "events": [
                    "MESSAGES_UPSERT",
                    "CONNECTION_UPDATE",
                    "QRCODE_UPDATED",
                ],
            }
        },
    )
    logger.info(f"[WEBHOOK] set for '{instance_name}' → {wh_resp.status_code}")
    return wh_resp


# ── Rate limiting ──────────────────────────────────────────────────────────────

async def _check_rate_limit(request: Request, action: str, max_calls: int, window_seconds: int):
    client_ip = request.client.host if request.client else "unknown"
    key = f"ratelimit:{action}:{client_ip}"
    try:
        r = await get_redis()
        count = await r.incr(key)
        if count == 1:
            await r.expire(key, window_seconds)
        if count > max_calls:
            logger.warning(f"Rate limit hit: {action} from {client_ip} ({count} calls)")
            raise HTTPException(
                status_code=429,
                detail=f"Trop de tentatives. Réessayez dans {window_seconds // 60} minute(s).",
                headers={"Retry-After": str(window_seconds)},
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Rate limit Redis error: {e}")


# ── OTP schemas ────────────────────────────────────────────────────────────────

class SendOTPRequest(BaseModel):
    phone_number: str


class VerifyOTPRequest(BaseModel):
    phone_number: str
    code: str


# ── OTP routes ─────────────────────────────────────────────────────────────────

@router.post("/send-otp", status_code=200)
async def send_otp(
    request: Request,
    data: SendOTPRequest,
    db: AsyncSession = Depends(get_db),
):
    phone = _normalize_phone(data.phone_number)
    await _check_rate_limit(request, f"send-otp:{phone}", max_calls=3, window_seconds=600)

    result = await db.execute(select(Business).where(Business.phone_number == phone))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Numéro déjà enregistré")

    code = await generate_otp(phone)
    sent = await asyncio.to_thread(send_otp_whatsapp, phone, code)
    if not sent:
        raise HTTPException(
            status_code=503,
            detail="Impossible d'envoyer l'OTP WhatsApp. Réessayez dans quelques secondes.",
        )
    return {"message": f"Code OTP envoyé sur WhatsApp au {phone}", "phone": phone}


@router.post("/verify-otp", status_code=200)
async def verify_otp_route(request: Request, data: VerifyOTPRequest):
    await _check_rate_limit(request, "verify-otp", max_calls=10, window_seconds=600)
    phone = _normalize_phone(data.phone_number)
    if not await verify_otp(phone, data.code):
        raise HTTPException(status_code=400, detail="Code OTP invalide ou expiré")
    return {"message": "Numéro vérifié avec succès", "phone": phone, "verified": True}


# ── Auth routes ────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: BusinessCreate, db: AsyncSession = Depends(get_db)):
    phone = _normalize_phone(data.phone_number)

    if not await is_phone_verified(phone):
        raise HTTPException(
            status_code=403,
            detail="Numéro non vérifié. Validez d'abord votre OTP WhatsApp.",
        )

    result = await db.execute(select(Business).where(Business.phone_number == phone))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Numéro déjà enregistré")

    business = Business(
        name=data.name,
        phone_number=phone,
        email=data.email,
        hashed_password=hash_password(data.password),
        business_type=data.business_type,
    )
    db.add(business)
    await db.flush()
    await db.refresh(business)
    await db.commit()
    await clear_otp(phone)

    token = create_access_token(business.id)
    return TokenResponse(
        access_token=token,
        business=BusinessResponse.model_validate(business),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    data: BusinessLogin,
    db: AsyncSession = Depends(get_db),
):
    await _check_rate_limit(request, "login", max_calls=5, window_seconds=60)

    phone = _normalize_phone(data.phone_number)
    result = await db.execute(select(Business).where(Business.phone_number == phone))
    business = result.scalar_one_or_none()

    if not business or not verify_password(data.password, business.hashed_password):
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    if not business.is_active:
        raise HTTPException(status_code=403, detail="Compte suspendu")

    token = create_access_token(business.id)
    return TokenResponse(
        access_token=token,
        business=BusinessResponse.model_validate(business),
    )


# ── WhatsApp QR flow ───────────────────────────────────────────────────────────

@router.post("/whatsapp/qr-connect")
async def qr_connect_whatsapp(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """
    Step 1: Create (or recreate) this business's Evolution instance and
    register our shared webhook. The instance name is deterministic so
    it never collides with any other business.

    After this returns, the frontend opens the WebSocket /whatsapp/qr-stream
    which polls Redis until the QR code arrives via the webhook.
    """
    instance_name = _instance_name(business.id)
    logger.info(f"[QR-CONNECT] Business '{business.name}' → instance '{instance_name}'")

    async with httpx.AsyncClient(timeout=20) as client:
        # Clean up any stale instance first (idempotent)
        await _delete_instance(client, instance_name)
        await asyncio.sleep(1.0)

        # Preserve existing token if the instance was previously created
        existing_token = None
        fetch_resp = await client.get(
            f"{EVOLUTION_BASE}/instance/fetchInstances",
            headers=_evolution_headers(),
        )
        if fetch_resp.status_code == 200:
            for inst in fetch_resp.json():
                if inst.get("name") == instance_name:
                    existing_token = inst.get("token")
                    break

        create_payload: dict = {
            "instanceName": instance_name,
            "qrcode": True,
            "integration": "WHATSAPP-BAILEYS",
        }
        if existing_token:
            create_payload["token"] = existing_token

        resp = await client.post(
            f"{EVOLUTION_BASE}/instance/create",
            headers=_evolution_headers(),
            json=create_payload,
        )
        logger.info(f"[QR-CONNECT] instance create → {resp.status_code}: {resp.text[:120]}")

        if resp.status_code not in (200, 201):
            raise HTTPException(
                status_code=500,
                detail=f"Impossible de créer l'instance WhatsApp: {resp.text}",
            )

        # Register the shared webhook so this instance's events reach /webhook
        await _set_webhook_for_instance(client, instance_name)

    # Persist the instance name so the webhook receiver can find this business
    business.evolution_instance_id = instance_name
    await db.flush()
    await db.commit()

    return {"instance": instance_name, "ready": True}


@router.websocket("/whatsapp/qr-stream")
async def qr_stream(
    websocket: WebSocket,
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    WebSocket stream that:
      1. Waits for the QR code to appear in Redis (posted there by /webhook)
      2. Sends the QR to the frontend
      3. Polls Evolution for connection state
      4. When state = 'open', persists the connected phone + updates Business record
      5. Sends the updated Business object back to the frontend

    All per-business — identified by JWT → business_id → evolution_instance_id.
    """
    import json as _json

    # ── Auth ──────────────────────────────────────────────────────────────
    try:
        payload     = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        business_id = payload.get("sub")
        if not business_id:
            await websocket.close(code=1008)
            return
        result = await db.execute(
            select(Business).where(Business.id == uuid.UUID(business_id))
        )
        business = result.scalar_one_or_none()
        if not business or not business.is_active:
            await websocket.close(code=1008)
            return
        # evolution_instance_id must be set — qr-connect is called first
        if not business.evolution_instance_id:
            await websocket.close(code=1008)
            return
    except Exception as e:
        logger.warning(f"QR stream auth failed: {e}")
        await websocket.close(code=1008)
        return

    await websocket.accept()
    instance_name = business.evolution_instance_id
    qr_redis_key  = f"qr:{instance_name}"

    # Clear any stale QR so we don't show an expired code
    await redis_delete(qr_redis_key)
    logger.info(f"QR stream opened for instance '{instance_name}' (business: {business.name})")

    async def _send(payload: dict):
        try:
            await websocket.send_text(_json.dumps(payload))
        except Exception:
            pass

    try:
        # ── Phase 1: wait for QR to appear in Redis (up to 60 s) ──────────
        qr_sent = None
        for _ in range(30):   # 30 × 2 s = 60 s
            await asyncio.sleep(2)
            qr = await redis_get(qr_redis_key)
            if qr:
                await _send({"qrcode": {"base64": qr}})
                qr_sent = qr
                logger.info(f"QR sent to frontend for '{instance_name}'")
                break
        else:
            await _send({"error": "QR timeout — réessayez"})
            logger.warning(f"QR timeout for instance '{instance_name}'")
            return

        # ── Phase 2: refresh QR if it rotates + poll for connection ───────
        for _ in range(150):  # 150 × 2 s = 5 min max scan window
            await asyncio.sleep(2)

            # Send new QR if it rotated
            new_qr = await redis_get(qr_redis_key)
            if new_qr and new_qr != qr_sent:
                await _send({"qrcode": {"base64": new_qr}})
                qr_sent = new_qr

            # Check connection state
            try:
                async with httpx.AsyncClient(timeout=5) as client:
                    state_resp = await client.get(
                        f"{EVOLUTION_BASE}/instance/connectionState/{instance_name}",
                        headers=_evolution_headers(),
                    )
                    if state_resp.status_code != 200:
                        continue
                    state = state_resp.json().get("instance", {}).get("state", "")

                    if state != "open":
                        continue

                    # ── Connected! Fetch phone number and persist ───────────
                    await _send({"state": "connecting"})

                    async with httpx.AsyncClient(timeout=10) as c2:
                        inst_resp = await c2.get(
                            f"{EVOLUTION_BASE}/instance/fetchInstances",
                            headers=_evolution_headers(),
                        )

                    phone = None
                    if inst_resp.status_code == 200:
                        for inst in inst_resp.json():
                            if inst.get("name") == instance_name:
                                owner = inst.get("ownerJid", "") or ""
                                phone = "+" + owner.split("@")[0] if "@" in owner else None
                                break

                    # Update DB
                    business.whatsapp_connected       = True
                    business.whatsapp_business_phone  = phone
                    business.whatsapp_phone_number_id = instance_name
                    business.status                   = BusinessStatus.CONNECTED
                    await db.flush()
                    await db.commit()
                    await db.refresh(business)

                    await _send({
                        "state": "open",
                        "business": BusinessResponse.model_validate(business).model_dump(),
                    })
                    logger.info(f"[QR] Business '{business.name}' connected → {phone}")
                    return

            except Exception as e:
                logger.debug(f"Connection poll error for '{instance_name}': {e}")

        # Timeout
        await _send({"error": "Connexion expirée — réessayez"})

    except WebSocketDisconnect:
        logger.info(f"QR stream disconnected by client for '{instance_name}'")
    except Exception as e:
        logger.error(f"QR stream error for '{instance_name}': {e}", exc_info=True)
        await _send({"error": str(e)})
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


@router.get("/whatsapp/qr-status")
async def qr_status(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    if not business.evolution_instance_id:
        return {"connected": False}

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{EVOLUTION_BASE}/instance/connectionState/{business.evolution_instance_id}",
            headers=_evolution_headers(),
        )

    if resp.status_code != 200:
        return {"connected": False}

    state = resp.json().get("instance", {}).get("state", "")
    if state != "open":
        return {"connected": False, "state": state}

    # Fetch phone and sync DB
    async with httpx.AsyncClient(timeout=10) as client:
        info_resp = await client.get(
            f"{EVOLUTION_BASE}/instance/fetchInstances",
            headers=_evolution_headers(),
        )

    phone = None
    if info_resp.status_code == 200:
        for inst in info_resp.json():
            if inst.get("name") == business.evolution_instance_id:
                owner = inst.get("ownerJid", "") or ""
                phone = "+" + owner.split("@")[0] if "@" in owner else None
                break

    if phone:
        business.whatsapp_connected       = True
        business.whatsapp_business_phone  = phone
        business.whatsapp_phone_number_id = business.evolution_instance_id
        business.status                   = BusinessStatus.CONNECTED
        await db.flush()
        await db.commit()
        await db.refresh(business)

    return {
        "connected": True,
        "phone": phone,
        "business": BusinessResponse.model_validate(business).model_dump(),
    }


@router.get("/whatsapp/qr-code")
async def get_fresh_qr(business: Business = Depends(get_current_business)):
    if not business.evolution_instance_id:
        raise HTTPException(status_code=400, detail="Aucune instance active")
    qr = await redis_get(f"qr:{business.evolution_instance_id}")
    if not qr:
        raise HTTPException(status_code=404, detail="QR code non disponible — réessayez")
    return {"qr_code": qr}


@router.delete("/whatsapp/disconnect", response_model=BusinessResponse)
async def disconnect_whatsapp(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """
    Disconnect THIS business's WhatsApp only.
    Other businesses are completely unaffected.
    """
    if business.evolution_instance_id:
        async with httpx.AsyncClient(timeout=10) as client:
            await _delete_instance(client, business.evolution_instance_id)
        logger.info(f"[DISCONNECT] '{business.name}' instance deleted")

    business.evolution_instance_id    = None
    business.whatsapp_phone_number_id = None
    business.whatsapp_access_token    = None
    business.whatsapp_connected       = False
    business.whatsapp_business_phone  = None
    business.status                   = BusinessStatus.NOT_CONNECTED

    await db.flush()
    await db.commit()
    await db.refresh(business)
    return BusinessResponse.model_validate(business)


@router.get("/me", response_model=BusinessResponse)
async def get_me(business: Business = Depends(get_current_business)):
    return BusinessResponse.model_validate(business)


@router.patch("/settings", response_model=BusinessResponse)
async def update_settings(
    data: BusinessUpdate,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(business, field, value)
    await db.flush()
    await db.commit()
    await db.refresh(business)
    return BusinessResponse.model_validate(business)
"""
app/services/whatsapp_service.py
─────────────────────────────────
Evolution API v2.3.7 message delivery — fully async.

CHANGES vs old version:
  - All send_*() functions migrated from httpx.Client (sync, blocks event loop)
    to httpx.AsyncClient (async, non-blocking).
  - WhatsAppService wrapper methods updated accordingly.
  - _wav_b64_to_ogg_b64() audio conversion is CPU-bound → run in thread pool
    via asyncio.to_thread() to avoid blocking the event loop during pydub/ffmpeg.
  - All callers in message_processor.py must `await` these functions.
"""
import io
import base64
import asyncio
import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

_EVOLUTION_HEADERS = {
    "apikey": settings.EVOLUTION_API_KEY,
    "Content-Type": "application/json",
}


def _wav_b64_to_ogg_b64_sync(raw_b64: str, source_mime: str = "audio/wav") -> tuple[str, str]:
    """
    Convert raw base64 audio (WAV or MP3) → raw base64 OGG/Opus.
    Synchronous — called via asyncio.to_thread().

    WHY OGG/Opus: WhatsApp only renders audio as a voice note bubble when the
    mimetype is audio/ogg with Opus codec. WAV/MP3 is silently dropped or
    delivered as a document.

    WHY to_thread: pydub calls ffmpeg as a subprocess — blocking I/O.
    Running it in the default thread pool keeps the event loop free.
    """
    try:
        from pydub import AudioSegment

        audio_bytes = base64.b64decode(raw_b64)
        mime_to_fmt = {
            "audio/mpeg": "mp3",
            "audio/mp3":  "mp3",
            "audio/wav":  "wav",
            "audio/wave": "wav",
            "audio/ogg":  "ogg",
        }
        base_mime = source_mime.split(";")[0].strip().lower()
        fmt_hint = mime_to_fmt.get(base_mime, None)

        if fmt_hint:
            audio = AudioSegment.from_file(io.BytesIO(audio_bytes), format=fmt_hint)
            logger.info(f"pydub loaded audio as {fmt_hint} ({len(audio_bytes):,} B)")
        else:
            audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
            logger.info(f"pydub auto-detected audio ({len(audio_bytes):,} B)")

        ogg_buf = io.BytesIO()
        audio.export(
            ogg_buf,
            format="ogg",
            codec="libopus",
            parameters=["-vbr", "on", "-compression_level", "10"],
        )
        ogg_bytes = ogg_buf.getvalue()
        ogg_b64 = base64.b64encode(ogg_bytes).decode("utf-8")
        logger.info(f"Audio→OGG/Opus: {len(audio_bytes):,} B → {len(ogg_bytes):,} B")
        return ogg_b64, "audio/ogg; codecs=opus"

    except Exception as e:
        logger.warning(f"Audio→OGG conversion failed ({e}) — sending original format as fallback")
        return raw_b64, source_mime


async def _wav_b64_to_ogg_b64(raw_b64: str, source_mime: str = "audio/wav") -> tuple[str, str]:
    """Async wrapper — runs CPU-bound pydub/ffmpeg in thread pool."""
    return await asyncio.to_thread(_wav_b64_to_ogg_b64_sync, raw_b64, source_mime)


async def send_text_message(
    phone_number_id: str,
    access_token: str,    # kept for API compat but unused (Evolution uses apikey header)
    to: str,
    text: str,
) -> httpx.Response | None:
    """Send a WhatsApp text message via Evolution API v2.3.7."""
    if not phone_number_id:
        logger.error("send_text_message: missing phone_number_id")
        return None

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{settings.EVOLUTION_API_URL}/message/sendText/{phone_number_id}",
                headers=_EVOLUTION_HEADERS,
                json={
                    "number": to,
                    "text": text,
                    "options": {
                        "delay": 1200,
                        "presence": "composing",
                        "linkPreview": False,
                    },
                },
            )
            if resp.status_code >= 400:
                logger.error(f"sendText {resp.status_code}: {resp.text[:200]} → {to}")
            else:
                logger.info(f"Text delivered to {to} ({resp.status_code})")
            return resp
    except Exception as e:
        logger.error(f"sendText failed: {e}")
        return None


async def send_audio_message(
    phone_number_id: str,
    to: str,
    audio_data_uri: str,
) -> bool:
    """
    Send an audio voice note via Evolution API v2.3.7.

    Pipeline:
      1. Parse data URI → extract mime + raw base64
      2. Convert to OGG/Opus in thread pool (non-blocking)
      3. POST to sendMedia (async)
    """
    if not phone_number_id or not audio_data_uri:
        logger.error("send_audio_message: missing phone_number_id or audio")
        return False

    source_mime = "audio/wav"
    if audio_data_uri.startswith("data:"):
        header, raw_b64 = audio_data_uri.split(",", 1)
        source_mime = header.split(":")[1].split(";")[0]
    else:
        raw_b64 = audio_data_uri

    logger.info(f"send_audio_message: source_mime={source_mime}, b64_len={len(raw_b64)}")

    # CPU-bound conversion runs in thread pool
    ogg_b64, mimetype = await _wav_b64_to_ogg_b64(raw_b64, source_mime)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.EVOLUTION_API_URL}/message/sendMedia/{phone_number_id}",
                headers=_EVOLUTION_HEADERS,
                json={
                    "number": to,
                    "mediatype": "audio",
                    "mimetype": mimetype,
                    "media": ogg_b64,
                    "options": {
                        "delay": 1000,
                        "presence": "recording",
                    },
                },
            )
            if resp.status_code >= 400:
                logger.error(f"sendAudio {resp.status_code}: {resp.text[:200]} → {to}")
                return False
            logger.info(f"Audio delivered to {to} ({resp.status_code})")
            return True
    except Exception as e:
        logger.error(f"sendAudio failed: {e}")
        return False


async def send_image_message(
    phone_number_id: str,
    access_token: str,    # kept for API compat
    to: str,
    image_url: str,
    caption: str = "",
) -> httpx.Response | None:
    """Send an image message via Evolution API v2.3.7."""
    if not phone_number_id:
        return None
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{settings.EVOLUTION_API_URL}/message/sendMedia/{phone_number_id}",
                headers=_EVOLUTION_HEADERS,
                json={
                    "number": to,
                    "mediatype": "image",
                    "media": image_url,
                    "caption": caption,
                },
            )
            if resp.status_code >= 400:
                logger.error(f"sendImage {resp.status_code}: {resp.text[:200]}")
            return resp
    except Exception as e:
        logger.error(f"sendImage failed: {e}")
        return None


class WhatsAppService:
    """
    Async wrapper around the Evolution API send functions.
    Used by appointments.py, promotions.py, and any route needing
    `wa = WhatsAppService(instance_id)` + `await wa.send_text(...)`.
    """

    def __init__(self, instance_id: str):
        self.instance_id = instance_id

    async def send_text(self, to: str, text: str) -> bool:
        resp = await send_text_message(
            phone_number_id=self.instance_id,
            access_token="",
            to=to,
            text=text,
        )
        return resp is not None and resp.status_code < 400

    async def send_audio(self, to: str, audio_data_uri: str) -> bool:
        return await send_audio_message(
            phone_number_id=self.instance_id,
            to=to,
            audio_data_uri=audio_data_uri,
        )

    async def send_image(self, to: str, image_url: str, caption: str = "") -> bool:
        resp = await send_image_message(
            phone_number_id=self.instance_id,
            access_token="",
            to=to,
            image_url=image_url,
            caption=caption,
        )
        return resp is not None and resp.status_code < 400
"""
app/redis_client.py
───────────────────
Singleton async Redis client used across the entire application.

Used for:
  - OTP storage (TTL 5 min)
  - QR code store (replaces in-memory _qr_store dict)
  - Rate limiting (via slowapi)
  - Session / promotion caching (future)

Railway: add REDIS_URL env var → redis://default:<password>@<host>:<port>
"""
import logging
from typing import Optional
import redis.asyncio as aioredis
from app.config import settings

logger = logging.getLogger(__name__)

_redis_client: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    """
    Return the shared Redis client, creating it on first call.
    FastAPI lifespan should call init_redis() on startup instead,
    but this lazy-init is a safe fallback.
    """
    global _redis_client
    if _redis_client is None:
        await init_redis()
    return _redis_client


async def init_redis() -> None:
    """Call once at application startup (FastAPI lifespan)."""
    global _redis_client
    try:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30,
        )
        await _redis_client.ping()
        logger.info("Redis connected successfully")
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")
        raise


async def close_redis() -> None:
    """Call once at application shutdown (FastAPI lifespan)."""
    global _redis_client
    if _redis_client:
        await _redis_client.aclose()
        _redis_client = None
        logger.info("Redis connection closed")


# ── Convenience wrappers used by otp_service & webhook ────────────────────────

async def redis_set(key: str, value: str, ttl_seconds: int | None = None) -> None:
    r = await get_redis()
    if ttl_seconds:
        await r.setex(key, ttl_seconds, value)
    else:
        await r.set(key, value)


async def redis_get(key: str) -> str | None:
    r = await get_redis()
    return await r.get(key)


async def redis_delete(key: str) -> None:
    r = await get_redis()
    await r.delete(key)


async def redis_incr(key: str, ttl_seconds: int | None = None) -> int:
    r = await get_redis()
    val = await r.incr(key)
    if ttl_seconds and val == 1:          # set TTL only on first increment
        await r.expire(key, ttl_seconds)
    return val
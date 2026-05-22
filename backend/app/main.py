"""
app/main.py
────────────
FastAPI application entry point.

CHANGES vs old version:
  - Redis initialized on startup and closed on shutdown via lifespan.
  - If Redis is unavailable at startup, the app logs the error and exits
    immediately (fail-fast) rather than serving broken requests.
  - No other changes.
"""
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine, Base
from app.redis_client import init_redis, close_redis
from app.routes import auth, webhook, products, orders, conversations, dashboard
from app.routes import agent
from app.routes.appointments import router as appointments_router
from app.routes import promotions
from app.routes import customers
from app.routes import admin

logging.basicConfig(
    level=logging.INFO if settings.ENVIRONMENT == "development" else logging.WARNING,
    format="%(asctime)s — %(name)s — %(levelname)s — %(message)s",
)
logger = logging.getLogger(__name__)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting SuguAI backend...")

    # ── Redis ─────────────────────────────────────────────────────────────
    # Must connect before any request is served:
    #   - OTP verification (auth routes)
    #   - QR code storage (webhook + auth/qr-stream)
    #   - Rate limiting (auth routes)
    try:
        await init_redis()
    except Exception as e:
        logger.critical(f"Redis connection failed at startup: {e}. Aborting.")
        raise   # fail-fast: don't serve requests without Redis

    # ── Database (dev only) ───────────────────────────────────────────────
    if settings.ENVIRONMENT == "development":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables verified/created")

    logger.info("SuguAI backend ready ✓")
    yield

    # ── Shutdown ──────────────────────────────────────────────────────────
    logger.info("Shutting down...")
    await close_redis()
    await engine.dispose()
    logger.info("Shutdown complete")


app = FastAPI(
    title="SuguAI API",
    description="Multi-tenant WhatsApp AI business automation for Mali",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
_frontend = settings.FRONTEND_URL.rstrip("/")
_backend  = settings.BACKEND_URL.rstrip("/")

ALLOWED_ORIGINS = list({
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    _frontend,
    _backend,
})

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info(f"CORS allowed origins: {ALLOWED_ORIGINS}")

# ── Static files (uploaded product images) ────────────────────────────────────
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ── Routes ─────────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(webhook.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(conversations.router)
app.include_router(dashboard.router)
app.include_router(agent.router)
app.include_router(appointments_router)
app.include_router(promotions.router)
app.include_router(customers.router)
app.include_router(admin.router) 


@app.get("/health")
async def health_check():
    from app.redis_client import get_redis
    redis_ok = False
    try:
        r = await get_redis()
        await r.ping()
        redis_ok = True
    except Exception:
        pass
    return {
        "status": "healthy" if redis_ok else "degraded",
        "environment": settings.ENVIRONMENT,
        "redis": "ok" if redis_ok else "unavailable",
    }
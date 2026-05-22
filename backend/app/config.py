"""
app/config.py
──────────────
Application settings loaded from environment variables / .env file.

CHANGES vs old version:
  - REDIS_URL added (required for OTP, QR store, rate limiting).
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ===============================
    # DATABASE
    # ===============================
    DATABASE_URL: str
    SYNC_DATABASE_URL: str

    # ===============================
    # REDIS
    # ===============================
    # Railway: add a Redis service and copy its REDIS_URL / REDIS_PRIVATE_URL.
    # Local dev: redis://localhost:6379/0
    REDIS_URL: str = "redis://localhost:6379/0"

    # ===============================
    # SECURITY
    # ===============================
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440   # 24 hours
    ENCRYPTION_KEY: str

    # ===============================
    # ENVIRONMENT
    # ===============================
    ENVIRONMENT: str = "development"

    # ===============================
    # APP URLS
    # ===============================
    BACKEND_URL: str
    FRONTEND_URL: str

    # ===============================
    # META / WHATSAPP (legacy)
    # ===============================
    META_APP_ID: str
    META_APP_SECRET: str
    META_VERIFY_TOKEN: str
    WHATSAPP_PHONE_NUMBER_ID: str
    WHATSAPP_ACCESS_TOKEN: str

    # ===============================
    # EVOLUTION API
    # ===============================
    EVOLUTION_API_URL: str
    EVOLUTION_API_KEY: str

    # ===============================
    # TWILIO (sandbox testing)
    # ===============================
    TWILIO_ACCOUNT_SID: str
    TWILIO_AUTH_TOKEN: str
    TWILIO_WHATSAPP_NUMBER: str

    # ===============================
    # AI PROVIDER
    # ===============================
    ANTHROPIC_API_KEY: str

    # ===============================
    # OTP SENDER (DBuddyZ)
    # ===============================
    DBUDDYZ_TOKEN: str = ""

    # ===============================
    # TTS (Djelia)
    # ===============================
    DJELIA_API_KEY: str = ""

    # ADMIN
    # ===============================
    ADMIN_SECRET_KEY: str = "suguai-admin-change-me"

    # ===============================
    # OTP WhatsApp Instance
    # ===============================
    OTP_EVOLUTION_INSTANCE: str = ""  # ex: "suguai-otp"

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
"""
app/dependencies.py
────────────────────
FastAPI dependencies: JWT creation/validation, current business extraction.

CHANGES vs old version:
  - create_access_token() now includes `exp` claim (was missing — tokens were immortal)
  - Token expiry respects settings.ACCESS_TOKEN_EXPIRE_MINUTES (default 1440 = 24h)
  - Uses timezone-aware datetime to avoid deprecation warnings on Python 3.12+
"""
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.config import settings
from app.database import get_db
from app.models.business import Business

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def create_access_token(business_id: uuid.UUID) -> str:
    """
    Create a signed JWT token for a business.
    Token expires after settings.ACCESS_TOKEN_EXPIRE_MINUTES (default 24h).
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(business_id),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_business(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Business:
    """
    FastAPI dependency: extract and validate JWT, return current Business.
    Raises 401 if token is invalid, expired, or business not found/inactive.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        business_id: str = payload.get("sub")
        if business_id is None:
            raise credentials_exception
    except JWTError:
        # Covers: ExpiredSignatureError, DecodeError, InvalidTokenError
        raise credentials_exception

    result = await db.execute(
        select(Business).where(Business.id == uuid.UUID(business_id))
    )
    business = result.scalar_one_or_none()

    if business is None or not business.is_active:
        raise credentials_exception

    return business
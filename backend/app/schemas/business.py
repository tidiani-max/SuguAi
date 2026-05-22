# backend/app/schemas/business.py

from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.business import BusinessType, BusinessStatus


class BusinessCreate(BaseModel):
    name: str
    phone_number: str
    email: Optional[EmailStr] = None
    password: str
    business_type: BusinessType = BusinessType.PRODUCTS_SELLER


class BusinessLogin(BaseModel):
    phone_number: str
    password: str


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    faq: Optional[str] = None
    payment_instructions: Optional[str] = None
    ai_tone: Optional[str] = None


class WhatsAppManualConnect(BaseModel):
    phone_number_id: str
    access_token: str


class BusinessResponse(BaseModel):
    id: UUID
    name: str
    phone_number: str
    email: Optional[str] = None
    business_type: BusinessType
    status: BusinessStatus
    whatsapp_connected: bool
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_business_phone: Optional[str] = None
    description: Optional[str] = None
    faq: Optional[str] = None
    payment_instructions: Optional[str] = None
    ai_tone: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    business: BusinessResponse
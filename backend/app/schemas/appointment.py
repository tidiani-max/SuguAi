# backend/app/schemas/appointment.py
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.appointment import AppointmentStatus


class AppointmentResponse(BaseModel):
    id: UUID
    business_id: UUID
    service_name: str
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    status: AppointmentStatus
    price: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AppointmentUpdate(BaseModel):
    service_name: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    price: Optional[str] = None
    notes: Optional[str] = None


class AppointmentCancel(BaseModel):
    reason: Optional[str] = None
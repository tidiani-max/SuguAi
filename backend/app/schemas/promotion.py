import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel
from app.models.promotion import PromotionStatus


class PromotionCreate(BaseModel):
    title:                  str
    message:                str
    product_id:             Optional[uuid.UUID] = None
    discount_amount:        Optional[Decimal]   = None
    recipient_customer_ids: Optional[List[uuid.UUID]] = None
    scheduled_at:           Optional[datetime]  = None
    expires_at:             Optional[datetime]  = None  # ← nouveau


class ProductSnippet(BaseModel):
    id:        uuid.UUID
    name:      str
    price:     float
    image_url: Optional[str] = None
    model_config = {"from_attributes": True}


class PromotionOut(BaseModel):
    id:                     uuid.UUID
    title:                  str
    message:                str
    status:                 PromotionStatus
    product_id:             Optional[uuid.UUID]
    discount_amount:        Optional[float]
    recipient_customer_ids: Optional[str]
    scheduled_at:           Optional[datetime]
    expires_at:             Optional[datetime]  # ← nouveau
    sent_at:                Optional[datetime]
    recipient_count:        int
    delivered_count:        int
    created_at:             datetime
    product:                Optional[ProductSnippet] = None
    model_config = {"from_attributes": True}
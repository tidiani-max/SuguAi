# backend/app/schemas/order.py
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from app.models.order import OrderStatus


class OrderItemResponse(BaseModel):
    id:           UUID
    product_name: str
    unit_price:   Decimal
    quantity:     int
    subtotal:     Decimal
    color:        Optional[str] = None
    size:         Optional[str] = None

    class Config:
        from_attributes = True


class PromotionSnippet(BaseModel):
    id:              UUID
    title:           str
    discount_amount: Optional[float] = None
    expires_at:      Optional[datetime] = None

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id:                     UUID
    order_number:           str
    status:                 OrderStatus
    total_amount:           Decimal
    payment_screenshot_url: Optional[str]      = None
    payment_verified_at:    Optional[datetime]  = None
    created_at:             datetime
    items:                  List[OrderItemResponse]

    # Customer details
    customer_name:     Optional[str] = None
    customer_phone:    Optional[str] = None
    delivery_address:  Optional[str] = None
    customer_language: Optional[str] = "french"

    # Promotion applied
    promotion_id:       Optional[UUID]             = None
    promotion_discount: Optional[Decimal]          = None
    promotion:          Optional[PromotionSnippet] = None

    class Config:
        from_attributes = True


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
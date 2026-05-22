"""
app/schemas/product.py
───────────────────────
Pydantic schemas for Product + ProductVariant.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from decimal import Decimal
from datetime import datetime


# ── Variant schemas ────────────────────────────────────────────────────────────

class VariantCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color_hex: Optional[str] = None          # e.g. "#E53E3E"
    image_url: Optional[str] = None
    stock: int = Field(0, ge=0)
    sort_order: int = 0


class VariantUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    color_hex: Optional[str] = None
    image_url: Optional[str] = None
    stock: Optional[int] = Field(None, ge=0)
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class VariantResponse(BaseModel):
    id: UUID
    product_id: UUID
    name: str
    color_hex: Optional[str] = None
    image_url: Optional[str] = None
    stock: int
    sort_order: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Product schemas ────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: Decimal
    stock: int = 0                           # global stock (used when no variants)
    unit: str = "unité"
    image_url: Optional[str] = None
    variants: Optional[List[VariantCreate]] = []   # optional at creation time


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    stock: Optional[int] = None
    unit: Optional[str] = None
    is_active: Optional[bool] = None
    image_url: Optional[str] = None
    # Full variant replacement: if provided, replaces all existing variants.
    # Omit the field entirely to leave variants untouched.
    variants: Optional[List[VariantCreate]] = None


class ProductResponse(BaseModel):
    id: UUID
    business_id: UUID
    name: str
    description: Optional[str] = None
    price: Decimal
    stock: int                               # global / fallback stock
    unit: str
    image_url: Optional[str] = None
    is_active: bool
    created_at: datetime
    variants: List[VariantResponse] = []     # empty list when no variants

    class Config:
        from_attributes = True
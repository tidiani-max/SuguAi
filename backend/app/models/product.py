"""
app/models/product.py
──────────────────────
Product + ProductVariant models.

ProductVariant: a color/design/flavor option linked to a Product.
Each variant has its own name, image, and stock.
The product's total stock = sum of variant stocks (if variants exist)
                          = product.stock field (if no variants).

This logic is enforced at the API layer, not the DB layer, for flexibility.
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import String, DateTime, Text, Numeric, Integer, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class ProductVariant(Base):
    __tablename__ = "product_variants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
    )

    # e.g. "Rouge", "Bleu nuit", "Design floral", "Taille L", "Vanille"
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Optional hex color hint for UI (e.g. "#E53E3E") — not required
    color_hex: Mapped[str] = mapped_column(String(10), nullable=True)

    # Each variant can have its own photo
    image_url: Mapped[str] = mapped_column(String(500), nullable=True)

    # Stock for this specific variant
    stock: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Display order in UI
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    # Relationship back to parent product
    product: Mapped["Product"] = relationship("Product", back_populates="variants")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    # Global stock — used when no variants exist.
    # When variants exist, this field is auto-synced to sum(variant.stock).
    stock: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    unit: Mapped[str] = mapped_column(String(50), default="unité", nullable=True)

    # Main product image (shown when no variant is selected)
    image_url: Mapped[str] = mapped_column(String(500), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    # Relationships
    business: Mapped["Business"] = relationship("Business", back_populates="products")
    order_items: Mapped[list["OrderItem"]] = relationship("OrderItem", back_populates="product")
    variants: Mapped[list["ProductVariant"]] = relationship(
        "ProductVariant",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductVariant.sort_order",
    )

    @property
    def effective_stock(self) -> int:
        """Total stock: sum of active variant stocks, or global stock if no variants."""
        active = [v for v in self.variants if v.is_active]
        if active:
            return sum(v.stock for v in active)
        return self.stock
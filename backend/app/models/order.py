"""
backend/app/models/order.py
"""
import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, ForeignKey, Numeric, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Enum as SAEnum
import enum

from app.database import Base


class OrderStatus(str, enum.Enum):
    PENDING_PAYMENT = "pending_payment"
    PAID            = "paid"
    PROCESSING      = "processing"
    SHIPPED         = "shipped"
    DELIVERED       = "delivered"
    CANCELLED       = "cancelled"


class Order(Base):
    __tablename__ = "orders"

    id:              Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id:     Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    customer_id:     Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    conversation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True)

    # ── Promotion applied at order time ───────────────────────────────────
    promotion_id:       Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("promotions.id", ondelete="SET NULL"), nullable=True)
    promotion_discount: Mapped[Decimal]   = mapped_column(Numeric(12, 2), nullable=True)  # amount saved

    order_number:            Mapped[str]      = mapped_column(String(50), unique=True, nullable=False)
    status:                  Mapped[OrderStatus] = mapped_column(
        SAEnum(OrderStatus, values_callable=lambda x: [e.value for e in x], name="orderstatus"),
        default=OrderStatus.PENDING_PAYMENT, nullable=False
    )
    total_amount:            Mapped[Decimal]  = mapped_column(Numeric(12, 2), nullable=False)
    payment_screenshot_url:  Mapped[str]      = mapped_column(String(500), nullable=True)
    payment_verified_at:     Mapped[datetime] = mapped_column(DateTime, nullable=True)
    payment_reference:       Mapped[str]      = mapped_column(String(255), nullable=True)
    shipping_address:        Mapped[str]      = mapped_column(Text, nullable=True)
    notes:                   Mapped[str]      = mapped_column(Text, nullable=True)
    created_at:              Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:              Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── Customer details captured from WhatsApp conversation ──────────────
    customer_name:     Mapped[str] = mapped_column(String(255), nullable=True)
    customer_phone:    Mapped[str] = mapped_column(String(50),  nullable=True)
    delivery_address:  Mapped[str] = mapped_column(Text, nullable=True)
    customer_language: Mapped[str] = mapped_column(String(20),  nullable=True, default="french")

    business:     Mapped["Business"]     = relationship("Business", back_populates="orders")
    customer:     Mapped["Customer"]     = relationship("Customer", back_populates="orders")
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="orders")
    promotion:    Mapped["Promotion"]    = relationship("Promotion")
    items:        Mapped[list["OrderItem"]] = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id:           Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id:     Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id",    ondelete="CASCADE"),  nullable=False)
    product_id:   Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id",  ondelete="SET NULL"), nullable=True)

    product_name: Mapped[str]     = mapped_column(String(255), nullable=False)
    unit_price:   Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    quantity:     Mapped[int]     = mapped_column(Integer, nullable=False)
    subtotal:     Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    # ── Variant details ───────────────────────────────────────────────────
    color: Mapped[str] = mapped_column(String(100), nullable=True)
    size:  Mapped[str] = mapped_column(String(50),  nullable=True)

    order:   Mapped["Order"]   = relationship("Order",   back_populates="items")
    product: Mapped["Product"] = relationship("Product", back_populates="order_items")
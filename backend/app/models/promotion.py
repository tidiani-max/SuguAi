import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Text, Integer, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Enum as SAEnum
import enum

from app.database import Base


class PromotionStatus(str, enum.Enum):
    draft     = "draft"
    scheduled = "scheduled"
    sending   = "sending"
    sent      = "sent"
    cancelled = "cancelled"


class Promotion(Base):
    __tablename__ = "promotions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False
    )
    title:           Mapped[str] = mapped_column(String(255), nullable=False)
    message:         Mapped[str] = mapped_column(Text, nullable=False)
    product_id:      Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=True)
    recipient_customer_ids: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[PromotionStatus] = mapped_column(
        SAEnum(PromotionStatus, values_callable=lambda x: [e.value for e in x], name="promotionstatus"),
        default=PromotionStatus.draft
    )
    scheduled_at:    Mapped[datetime] = mapped_column(DateTime, nullable=True)
    expires_at:      Mapped[datetime] = mapped_column(DateTime, nullable=True)  # ← fin de promo
    sent_at:         Mapped[datetime] = mapped_column(DateTime, nullable=True)
    recipient_count: Mapped[int]      = mapped_column(Integer, default=0)
    delivered_count: Mapped[int]      = mapped_column(Integer, default=0)
    created_at:      Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    business: Mapped["Business"] = relationship("Business", back_populates="promotions")
    product:  Mapped["Product"]  = relationship("Product")
# conversation model.py
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Enum as SAEnum
import enum

from app.database import Base




class ConversationState(str, enum.Enum):
    BROWSING = "browsing"
    AWAITING_PAYMENT = "awaiting_payment"
    PAYMENT_VERIFICATION = "payment_verification"
    COMPLETED = "completed"
    HUMAN_TAKEOVER = "human_takeover"


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)

    state: Mapped[ConversationState] = mapped_column(
        SAEnum(ConversationState, values_callable=lambda x: [e.value for e in x], name="conversationstate"),
        default=ConversationState.BROWSING,
        nullable=False
    )

    pending_cart: Mapped[str] = mapped_column(Text, nullable=True)
    pending_total: Mapped[str] = mapped_column(String(50), nullable=True)
    ai_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_message_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    business: Mapped["Business"] = relationship("Business", back_populates="conversations")
    customer: Mapped["Customer"] = relationship("Customer", back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship("Message", back_populates="conversation", order_by="Message.created_at")
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="conversation")

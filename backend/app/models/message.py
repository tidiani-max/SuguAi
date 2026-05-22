# messages model.py

import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Enum as SAEnum
import enum

from app.database import Base


class MessageDirection(str, enum.Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class MessageType(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    DOCUMENT = "document"
    INTERACTIVE = "interactive"


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)

    direction: Mapped[MessageDirection] = mapped_column(
        SAEnum(MessageDirection, values_callable=lambda x: [e.value for e in x], name="messagedirection"),
        nullable=False
    )
    message_type: Mapped[MessageType] = mapped_column(
        SAEnum(MessageType, values_callable=lambda x: [e.value for e in x], name="messagetype"),
        default=MessageType.TEXT
    )

    content: Mapped[str] = mapped_column(Text, nullable=True)
    media_url: Mapped[str] = mapped_column(String(500), nullable=True)
    media_id: Mapped[str] = mapped_column(String(255), nullable=True)
    whatsapp_message_id: Mapped[str] = mapped_column(String(255), nullable=True)
    ocr_text: Mapped[str] = mapped_column(Text, nullable=True)
    is_payment_screenshot: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")

# conversations schema.py

from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.models.conversation import ConversationState
from app.models.message import MessageDirection, MessageType


class MessageResponse(BaseModel):
    id: UUID
    direction: MessageDirection
    message_type: MessageType
    content: Optional[str]
    media_url: Optional[str]
    is_payment_screenshot: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: UUID
    customer_id: UUID
    customer_phone: Optional[str] = None
    customer_name: Optional[str] = None
    state: ConversationState
    ai_enabled: bool
    last_message_at: datetime
    messages: Optional[List[MessageResponse]] = None

    class Config:
        from_attributes = True
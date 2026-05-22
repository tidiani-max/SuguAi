from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
import uuid

from app.database import get_db
from app.models.conversation import Conversation
from app.models.business import Business
from app.schemas.conversation import ConversationResponse
from app.dependencies import get_current_business

router = APIRouter(prefix="/conversations", tags=["Conversations"])


def _serialize(c: Conversation) -> ConversationResponse:
    """Build a ConversationResponse, injecting customer phone/name."""
    base = ConversationResponse.model_validate(c)
    base.customer_phone = c.customer.whatsapp_phone if c.customer else None
    base.customer_name = c.customer.display_name if c.customer else None
    return base


@router.get("/", response_model=List[ConversationResponse])
async def list_conversations(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db)
):
    """List all conversations sorted by most recent message."""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.business_id == business.id)
        .options(
            selectinload(Conversation.messages),
            selectinload(Conversation.customer),
        )
        .order_by(Conversation.last_message_at.desc())
    )
    return [_serialize(c) for c in result.scalars().all()]


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: uuid.UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db)
):
    """Get a conversation with all its messages."""
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.business_id == business.id,
        )
        .options(
            selectinload(Conversation.messages),
            selectinload(Conversation.customer),
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return _serialize(conv)


@router.post("/{conversation_id}/takeover")
async def toggle_human_takeover(
    conversation_id: uuid.UUID,
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db)
):
    """Toggle AI on/off for a conversation (human takeover mode)."""
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.business_id == business.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conv.ai_enabled = not conv.ai_enabled
    await db.flush()
    return {"ai_enabled": conv.ai_enabled, "conversation_id": str(conversation_id)}
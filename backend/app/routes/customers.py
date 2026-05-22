from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from pydantic import BaseModel
from datetime import datetime
import uuid

from app.database import get_db
from app.dependencies import get_current_business
from app.models.customer import Customer
from app.models.business import Business

router = APIRouter(prefix="/customers", tags=["Customers"])


class CustomerOut(BaseModel):
    id:             uuid.UUID
    whatsapp_phone: str
    display_name:   str | None
    is_blocked:     bool
    created_at:     datetime
    last_seen:      datetime

    model_config = {"from_attributes": True}


@router.get("/", response_model=List[CustomerOut])
async def list_customers(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer)
        .where(
            Customer.business_id == business.id,
            Customer.is_blocked == False,
        )
        .order_by(Customer.last_seen.desc())
    )
    return result.scalars().all()
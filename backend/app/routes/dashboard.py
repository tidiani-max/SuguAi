"""
backend/app/routes/dashboard.py

Returns different stats depending on business_type:
  - products_seller  → orders, revenue, top products
  - fnb              → same as products_seller (orders = food orders)
  - service_information → appointments, upcoming, done count
  - custom           → messages only
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, date, timedelta
from typing import Optional

from app.database import get_db
from app.models.business import Business, BusinessType
from app.models.order import Order, OrderItem, OrderStatus
from app.models.message import Message, MessageDirection
from app.models.conversation import Conversation
from app.models.appointment import Appointment, AppointmentStatus
from app.dependencies import get_current_business
from app.models.promotion import Promotion, PromotionStatus as PromoStatus
from app.models.customer import Customer

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

# Payment confirmed statuses (money secured)
PAID_STATUSES = [
    OrderStatus.PAID,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
]


def get_period_start(period: str) -> Optional[datetime]:
    today = date.today()
    if period == "today":
        return datetime.combine(today, datetime.min.time())
    elif period == "week":
        return datetime.combine(today - timedelta(days=7), datetime.min.time())
    elif period == "month":
        return datetime.combine(today - timedelta(days=30), datetime.min.time())
    return None  # "all" → no filter


def with_period(filters: list, period_start, date_col) -> list:
    if period_start:
        return filters + [date_col >= period_start]
    return filters


# ─────────────────────────────────────────────────────────────────────────────
# Shared: inbound message count
# ─────────────────────────────────────────────────────────────────────────────
async def _messages_count(db, business_id, period_start) -> int:
    msg_filters = [
        Conversation.business_id == business_id,
        Message.direction == MessageDirection.INBOUND,
    ]
    if period_start:
        msg_filters.append(Message.created_at >= period_start)
    result = await db.execute(
        select(func.count(Message.id))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(and_(*msg_filters))
    )
    return result.scalar() or 0


# ─────────────────────────────────────────────────────────────────────────────
# SELL / FNB stats
# ─────────────────────────────────────────────────────────────────────────────
async def _sell_stats(db, business, period, period_start):
    base = [Order.business_id == business.id]

    # Total orders in period
    orders_result = await db.execute(
        select(func.count(Order.id)).where(
            and_(*with_period(base, period_start, Order.created_at))
        )
    )
    orders_count = orders_result.scalar() or 0

    # Pending payment count (live, no period filter — always current)
    pending_result = await db.execute(
        select(func.count(Order.id)).where(
            and_(
                Order.business_id == business.id,
                Order.status == OrderStatus.PENDING_PAYMENT,
            )
        )
    )
    pending_orders = pending_result.scalar() or 0

    # ── Confirmed revenue (paid statuses only) ────────────────────────────
    revenue_result = await db.execute(
        select(func.sum(Order.total_amount)).where(
            and_(*with_period(
                base + [Order.status.in_(PAID_STATUSES)],
                period_start, Order.created_at
            ))
        )
    )
    total_revenue = float(revenue_result.scalar() or 0)

    # ── Unpaid revenue = sum of pending_payment orders in period ──────────
    # This is money "promised" but not yet confirmed — shown as a warning
    unpaid_revenue_result = await db.execute(
        select(func.sum(Order.total_amount)).where(
            and_(*with_period(
                base + [Order.status == OrderStatus.PENDING_PAYMENT],
                period_start, Order.created_at
            ))
        )
    )
    unpaid_revenue = float(unpaid_revenue_result.scalar() or 0)

    messages_count = await _messages_count(db, business.id, period_start)

    # Top products (from paid orders only)
    top_products_result = await db.execute(
        select(
            OrderItem.product_name,
            func.sum(OrderItem.quantity).label("total_sold"),
            func.sum(OrderItem.subtotal).label("revenue"),
        )
        .join(Order, OrderItem.order_id == Order.id)
        .where(and_(*with_period(
            base + [Order.status.in_(PAID_STATUSES)],
            period_start, Order.created_at
        )))
        .group_by(OrderItem.product_name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(5)
    )
    top_products = [
        {
            "product_name": row.product_name,
            "total_sold": int(row.total_sold),
            "revenue": float(row.revenue),
        }
        for row in top_products_result.fetchall()
    ]

    return {
        "type": "sell",
        "orders_count": orders_count,
        "pending_orders": pending_orders,
        "total_revenue": total_revenue,
        "unpaid_revenue": unpaid_revenue,   # ← NEW
        "messages_count": messages_count,
        "top_products": top_products,
        "period": period,
    }


# ─────────────────────────────────────────────────────────────────────────────
# SERVICE stats
# ─────────────────────────────────────────────────────────────────────────────
async def _service_stats(db, business, period, period_start):
    base = [Appointment.business_id == business.id]

    total_result = await db.execute(
        select(func.count(Appointment.id)).where(
            and_(*with_period(base, period_start, Appointment.created_at))
        )
    )
    total_appointments = total_result.scalar() or 0

    pending_result = await db.execute(
        select(func.count(Appointment.id)).where(
            and_(Appointment.business_id == business.id,
                 Appointment.status == AppointmentStatus.PENDING)
        )
    )
    pending_appointments = pending_result.scalar() or 0

    confirmed_result = await db.execute(
        select(func.count(Appointment.id)).where(
            and_(Appointment.business_id == business.id,
                 Appointment.status == AppointmentStatus.CONFIRMED)
        )
    )
    confirmed_appointments = confirmed_result.scalar() or 0

    done_result = await db.execute(
        select(func.count(Appointment.id)).where(
            and_(*with_period(
                base + [Appointment.status == AppointmentStatus.DONE],
                period_start, Appointment.created_at
            ))
        )
    )
    done_appointments = done_result.scalar() or 0

    top_services_result = await db.execute(
        select(
            Appointment.service_name,
            func.count(Appointment.id).label("total_bookings"),
        )
        .where(and_(*with_period(base, period_start, Appointment.created_at)))
        .group_by(Appointment.service_name)
        .order_by(func.count(Appointment.id).desc())
        .limit(5)
    )
    top_services = [
        {"service_name": row.service_name, "total_bookings": int(row.total_bookings)}
        for row in top_services_result.fetchall()
    ]

    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end   = datetime.combine(date.today(), datetime.max.time())
    today_result = await db.execute(
        select(func.count(Appointment.id)).where(
            and_(
                Appointment.business_id == business.id,
                Appointment.scheduled_at >= today_start,
                Appointment.scheduled_at <= today_end,
                Appointment.status.in_([AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING]),
            )
        )
    )
    today_appointments = today_result.scalar() or 0

    messages_count = await _messages_count(db, business.id, period_start)

    return {
        "type": "service",
        "total_appointments": total_appointments,
        "pending_appointments": pending_appointments,
        "confirmed_appointments": confirmed_appointments,
        "done_appointments": done_appointments,
        "today_appointments": today_appointments,
        "top_services": top_services,
        "messages_count": messages_count,
        "period": period,
    }


# ─────────────────────────────────────────────────────────────────────────────
# CUSTOM stats
# ─────────────────────────────────────────────────────────────────────────────
async def _custom_stats(db, business, period, period_start):
    messages_count = await _messages_count(db, business.id, period_start)

    conv_filters = [Conversation.business_id == business.id]
    if period_start:
        conv_filters.append(Conversation.last_message_at >= period_start)
    conv_result = await db.execute(
        select(func.count(Conversation.id)).where(and_(*conv_filters))
    )
    active_conversations = conv_result.scalar() or 0

    return {
        "type": "custom",
        "messages_count": messages_count,
        "active_conversations": active_conversations,
        "period": period,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main endpoint
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/stats")
async def get_dashboard_stats(
    period: str = Query("today"),
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    period_start = get_period_start(period)

    if business.business_type in (BusinessType.PRODUCTS_SELLER, BusinessType.FNB):
        return await _sell_stats(db, business, period, period_start)
    elif business.business_type == BusinessType.SERVICE_INFORMATION:
        return await _service_stats(db, business, period, period_start)
    else:
        return await _custom_stats(db, business, period, period_start)
    
@router.get("/analytics")
async def get_analytics(
    business: Business = Depends(get_current_business),
    db: AsyncSession = Depends(get_db),
):
    """
    Données pour la page Analytique :
    totaux globaux + 7 derniers jours pour les graphiques.
    """
    from datetime import date, timedelta

    today = date.today()

    # ── Totaux globaux ────────────────────────────────────────────────────────
    total_customers = (await db.execute(
        select(func.count(Customer.id)).where(Customer.business_id == business.id)
    )).scalar() or 0

    total_messages = (await db.execute(
        select(func.count(Message.id))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(Conversation.business_id == business.id)
    )).scalar() or 0

    outbound_messages = (await db.execute(
        select(func.count(Message.id))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Conversation.business_id == business.id,
            Message.direction == MessageDirection.OUTBOUND,
        )
    )).scalar() or 0

    total_orders = (await db.execute(
        select(func.count(Order.id)).where(Order.business_id == business.id)
    )).scalar() or 0

    total_revenue = float((await db.execute(
        select(func.sum(Order.total_amount)).where(
            Order.business_id == business.id,
            Order.status.in_(PAID_STATUSES),
        )
    )).scalar() or 0)

    promos_total = (await db.execute(
        select(func.count(Promotion.id)).where(Promotion.business_id == business.id)
    )).scalar() or 0

    promos_sent = (await db.execute(
        select(func.count(Promotion.id)).where(
            Promotion.business_id == business.id,
            Promotion.status == PromoStatus.sent,
        )
    )).scalar() or 0

    # ── 7 derniers jours (graphiques) ────────────────────────────────────────
    daily_messages = []
    daily_revenue  = []

    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end   = datetime.combine(day, datetime.max.time())

        msg_count = (await db.execute(
            select(func.count(Message.id))
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(
                Conversation.business_id == business.id,
                Message.created_at >= day_start,
                Message.created_at <= day_end,
            )
        )).scalar() or 0

        rev = float((await db.execute(
            select(func.sum(Order.total_amount)).where(
                Order.business_id == business.id,
                Order.status.in_(PAID_STATUSES),
                Order.created_at >= day_start,
                Order.created_at <= day_end,
            )
        )).scalar() or 0)

        label = day.strftime("%d/%m")
        daily_messages.append({"date": label, "messages": msg_count})
        daily_revenue.append({"date": label, "revenue": rev})

    ai_rate = round((outbound_messages / total_messages * 100)) if total_messages > 0 else 0

    return {
        "totals": {
            "customers":        total_customers,
            "messages":         total_messages,
            "outbound_messages": outbound_messages,
            "orders":           total_orders,
            "revenue":          total_revenue,
            "ai_rate":          ai_rate,
            "promotions_sent":  promos_sent,
            "promotions_total": promos_total,
        },
        "charts": {
            "daily_messages": daily_messages,
            "daily_revenue":  daily_revenue,
        },
    }
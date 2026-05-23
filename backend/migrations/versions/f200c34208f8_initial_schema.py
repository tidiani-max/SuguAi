"""initial_schema

Revision ID: f200c34208f8
Revises: 
Create Date: 2026-02-24 01:27:51.550967

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f200c34208f8'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE businesstype AS ENUM (
                'products_seller','service_information','transport',
                'health','education','real_estate','events'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE businessstatus AS ENUM (
                'not_connected','connected','suspended'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE conversationstate AS ENUM (
                'browsing','awaiting_payment','payment_verification',
                'completed','human_takeover'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE messagedirection AS ENUM ('inbound','outbound');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE messagetype AS ENUM (
                'text','image','audio','document','interactive'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE orderstatus AS ENUM (
                'pending_payment','paid','processing',
                'shipped','delivered','cancelled'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE promotionstatus AS ENUM (
                'draft','scheduled','sending','sent','cancelled'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    op.create_table('businesses',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('phone_number', sa.String(20), unique=True, nullable=False),
        sa.Column('email', sa.String(255), unique=True, nullable=True),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('business_type', sa.Enum('products_seller','service_information','transport','health','education','real_estate','events', name='businesstype', create_type=False), nullable=False),
        sa.Column('evolution_instance_id', sa.String(255), unique=True, nullable=True),
        sa.Column('phone_number_id', sa.String(255), unique=True, nullable=True),
        sa.Column('access_token', sa.Text(), nullable=True),
        sa.Column('waba_id', sa.String(255), nullable=True),
        sa.Column('status', sa.Enum('not_connected','connected','suspended', name='businessstatus', create_type=False), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('faq', sa.Text(), nullable=True),
        sa.Column('payment_instructions', sa.Text(), nullable=True),
        sa.Column('ai_tone', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )

    op.create_table('customers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('whatsapp_phone', sa.String(30), nullable=False),
        sa.Column('display_name', sa.String(255), nullable=True),
        sa.Column('is_blocked', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('last_seen', sa.DateTime(), nullable=True),
    )

    op.create_table('products',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('price', sa.Numeric(12, 2), nullable=False),
        sa.Column('stock', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('unit', sa.String(50), nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )

    op.create_table('product_variants',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('color_hex', sa.String(10), nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('stock', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )

    op.create_table('promotions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='SET NULL'), nullable=True),
        sa.Column('discount_amount', sa.Numeric(12, 2), nullable=True),
        sa.Column('recipient_customer_ids', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('draft','scheduled','sending','sent','cancelled', name='promotionstatus', create_type=False), nullable=True),
        sa.Column('scheduled_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('recipient_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('delivered_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )

    op.create_table('conversations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('customers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('state', sa.Enum('browsing','awaiting_payment','payment_verification','completed','human_takeover', name='conversationstate', create_type=False), nullable=False),
        sa.Column('pending_cart', sa.Text(), nullable=True),
        sa.Column('pending_total', sa.String(50), nullable=True),
        sa.Column('ai_enabled', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('last_message_at', sa.DateTime(), nullable=True),
    )

    op.create_table('messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('direction', sa.Enum('inbound','outbound', name='messagedirection', create_type=False), nullable=False),
        sa.Column('message_type', sa.Enum('text','image','audio','document','interactive', name='messagetype', create_type=False), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('media_url', sa.String(500), nullable=True),
        sa.Column('media_id', sa.String(255), nullable=True),
        sa.Column('whatsapp_message_id', sa.String(255), nullable=True),
        sa.Column('ocr_text', sa.Text(), nullable=True),
        sa.Column('is_payment_screenshot', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )

    op.create_table('orders',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('customers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('conversations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('promotion_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('promotions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('promotion_discount', sa.Numeric(12, 2), nullable=True),
        sa.Column('order_number', sa.String(50), unique=True, nullable=False),
        sa.Column('status', sa.Enum('pending_payment','paid','processing','shipped','delivered','cancelled', name='orderstatus', create_type=False), nullable=False),
        sa.Column('total_amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('payment_screenshot_url', sa.String(500), nullable=True),
        sa.Column('payment_verified_at', sa.DateTime(), nullable=True),
        sa.Column('payment_reference', sa.String(255), nullable=True),
        sa.Column('shipping_address', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('customer_name', sa.String(255), nullable=True),
        sa.Column('customer_phone', sa.String(50), nullable=True),
        sa.Column('delivery_address', sa.Text(), nullable=True),
        sa.Column('customer_language', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )

    op.create_table('order_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='SET NULL'), nullable=True),
        sa.Column('product_name', sa.String(255), nullable=False),
        sa.Column('unit_price', sa.Numeric(12, 2), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('subtotal', sa.Numeric(12, 2), nullable=False),
        sa.Column('color', sa.String(100), nullable=True),
        sa.Column('size', sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('order_items')
    op.drop_table('orders')
    op.drop_table('messages')
    op.drop_table('conversations')
    op.drop_table('promotions')
    op.drop_table('product_variants')
    op.drop_table('products')
    op.drop_table('customers')
    op.drop_table('businesses')
    op.execute('DROP TYPE IF EXISTS promotionstatus')
    op.execute('DROP TYPE IF EXISTS orderstatus')
    op.execute('DROP TYPE IF EXISTS messagetype')
    op.execute('DROP TYPE IF EXISTS messagedirection')
    op.execute('DROP TYPE IF EXISTS conversationstate')
    op.execute('DROP TYPE IF EXISTS businessstatus')
    op.execute('DROP TYPE IF EXISTS businesstype')

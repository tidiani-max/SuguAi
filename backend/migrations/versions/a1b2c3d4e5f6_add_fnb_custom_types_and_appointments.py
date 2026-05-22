"""add_fnb_custom_types_and_appointments

Revision ID: a1b2c3d4e5f6
Revises: 83c501959c41
Create Date: 2025-05-02

Changes:
  1. Adds 'fnb' and 'custom' values to the businesstype enum
  2. Creates the appointments table
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'a1b2c3d4e5f6'
down_revision = '83c501959c41'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Extend businesstype enum ────────────────────────────────────────────
    # PostgreSQL requires ALTER TYPE to add new enum values
    op.execute("ALTER TYPE businesstype ADD VALUE IF NOT EXISTS 'fnb'")
    op.execute("ALTER TYPE businesstype ADD VALUE IF NOT EXISTS 'custom'")

    # ── 2. Create appointmentstatus enum ──────────────────────────────────────
    appointment_status = postgresql.ENUM(
        'pending', 'confirmed', 'done', 'cancelled',
        name='appointmentstatus'
    )
    appointment_status.create(op.get_bind(), checkfirst=True)

    # ── 3. Create appointments table ──────────────────────────────────────────
    op.create_table(
        'appointments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('customers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('conversations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('service_name', sa.String(255), nullable=False),
        sa.Column('scheduled_at', sa.DateTime, nullable=True),
        sa.Column('duration_minutes', sa.Integer, nullable=True),
        sa.Column('status', sa.Enum(
            'pending', 'confirmed', 'done', 'cancelled',
            name='appointmentstatus'
        ), nullable=False, server_default='pending'),
        sa.Column('price', sa.String(100), nullable=True),
        sa.Column('customer_name', sa.String(255), nullable=True),
        sa.Column('customer_phone', sa.String(50), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('now()')),
    )

    op.create_index('ix_appointments_business_id', 'appointments', ['business_id'])
    op.create_index('ix_appointments_scheduled_at', 'appointments', ['scheduled_at'])
    op.create_index('ix_appointments_status', 'appointments', ['status'])


def downgrade() -> None:
    op.drop_index('ix_appointments_status', table_name='appointments')
    op.drop_index('ix_appointments_scheduled_at', table_name='appointments')
    op.drop_index('ix_appointments_business_id', table_name='appointments')
    op.drop_table('appointments')
    op.execute("DROP TYPE IF EXISTS appointmentstatus")
    # Note: PostgreSQL does not support removing enum values natively.
    # To fully downgrade businesstype enum, you'd need to recreate it.
"""
backend/app/models/business.py
"""
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Enum as SAEnum
import enum

from app.database import Base


class BusinessType(str, enum.Enum):
    PRODUCTS_SELLER     = "products_seller"      # Vente produits / e-commerce
    SERVICE_INFORMATION = "service_information"   # Services / rendez-vous (salon, réparation…)
    FNB                 = "fnb"                   # Restaurant / café / traiteur
    TRANSPORT           = "transport"             # Bus, taxi, agence de voyage, moto
    HEALTH              = "health"                # Clinique, pharmacie, médecin, laboratoire
    EDUCATION           = "education"             # École, cours particuliers, formation, université
    REAL_ESTATE         = "real_estate"           # Immobilier, location, vente de terrain/maison
    EVENTS              = "events"                # Événementiel, DJ, photographe, décoration
    CUSTOM              = "custom"                # Autre / bot d'information seulement


class BusinessStatus(str, enum.Enum):
    NOT_CONNECTED = "not_connected"
    CONNECTED     = "connected"
    SUSPENDED     = "suspended"


class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    business_type: Mapped[BusinessType] = mapped_column(
        SAEnum(BusinessType, values_callable=lambda x: [e.value for e in x], name="businesstype"),
        default=BusinessType.PRODUCTS_SELLER,
        nullable=False,
    )

    # Evolution API instance (one per business, holds their WhatsApp connection)
    evolution_instance_id: Mapped[str] = mapped_column(String(255), nullable=True, unique=True)

    # WhatsApp info populated after QR scan
    whatsapp_phone_number_id: Mapped[str] = mapped_column(String(255), nullable=True, unique=True)
    whatsapp_access_token: Mapped[str] = mapped_column(Text, nullable=True)
    whatsapp_connected: Mapped[bool] = mapped_column(Boolean, default=False)
    whatsapp_business_phone: Mapped[str] = mapped_column(String(20), nullable=True)

    status: Mapped[BusinessStatus] = mapped_column(
        SAEnum(BusinessStatus, values_callable=lambda x: [e.value for e in x], name="businessstatus"),
        default=BusinessStatus.NOT_CONNECTED,
        nullable=False,
    )

    description: Mapped[str] = mapped_column(Text, nullable=True)
    faq: Mapped[str] = mapped_column(Text, nullable=True)
    payment_instructions: Mapped[str] = mapped_column(Text, nullable=True)
    ai_tone: Mapped[str] = mapped_column(String(100), default="professional", nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    products: Mapped[list["Product"]] = relationship("Product", back_populates="business", cascade="all, delete-orphan")
    customers: Mapped[list["Customer"]] = relationship("Customer", back_populates="business", cascade="all, delete-orphan")
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="business", cascade="all, delete-orphan")
    conversations: Mapped[list["Conversation"]] = relationship("Conversation", back_populates="business", cascade="all, delete-orphan")
    appointments: Mapped[list["Appointment"]] = relationship("Appointment", back_populates="business", cascade="all, delete-orphan")
    promotions: Mapped[list["Promotion"]] = relationship("Promotion", back_populates="business", cascade="all, delete-orphan")
"""
backend/app/models/appointment.py

Used by:
  - service_information businesses (salons, couturiers, médecins, réparateurs…)
  - fnb businesses (réservations de table, commandes à emporter)

The AI agent creates appointments automatically from WhatsApp conversations.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Enum as SAEnum
import enum

from app.database import Base


class AppointmentStatus(str, enum.Enum):
    PENDING   = "pending"    # Client a demandé, pas encore confirmé
    CONFIRMED = "confirmed"  # Le commerce a confirmé
    DONE      = "done"       # Rendez-vous terminé / livré
    CANCELLED = "cancelled"  # Annulé


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True
    )

    # Ce que le client veut (ex: "Coupe homme", "Table 4 personnes", "Réparation iPhone")
    service_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Date et heure souhaitées par le client
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Durée estimée en minutes (optionnel, pour les services)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=True)

    status: Mapped[AppointmentStatus] = mapped_column(
        SAEnum(AppointmentStatus, values_callable=lambda x: [e.value for e in x], name="appointmentstatus"),
        default=AppointmentStatus.PENDING,
        nullable=False,
    )

    # Prix si applicable
    price: Mapped[str] = mapped_column(String(100), nullable=True)

    # Infos client collectées par le bot WhatsApp
    customer_name: Mapped[str] = mapped_column(String(255), nullable=True)
    customer_phone: Mapped[str] = mapped_column(String(50), nullable=True)

    # Notes libres (demandes spéciales, taille de table, allergies…)
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    business: Mapped["Business"] = relationship("Business", back_populates="appointments")
    customer: Mapped["Customer"] = relationship("Customer")
    conversation: Mapped["Conversation"] = relationship("Conversation")
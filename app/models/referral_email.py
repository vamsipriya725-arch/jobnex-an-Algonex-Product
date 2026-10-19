"""
models/referral_email.py — The core referral email record with full lifecycle tracking.
"""
import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Integer, String, DateTime, ForeignKey, Text, Enum as SAEnum,
    Boolean, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ReferralEmailStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    APPROVED = "APPROVED"
    SENDING = "SENDING"
    SENT = "SENT"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class ReferralEmail(Base):
    __tablename__ = "referral_emails"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Ownership & relations
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    referral_contact_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("referral_contacts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Email content
    to_email: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)

    # Status tracking
    status: Mapped[ReferralEmailStatus] = mapped_column(
        SAEnum(ReferralEmailStatus, name="referral_email_status"),
        default=ReferralEmailStatus.DRAFT,
        nullable=False,
        index=True,
    )

    # Gmail message id returned after sending
    provider_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Follow-up settings
    follow_up_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    follow_up_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    follow_up_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    follow_up_count: Mapped[int] = mapped_column(Integer, default=0)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Duplicate-protection: one (user, job, contact) combination
    __table_args__ = (
        UniqueConstraint(
            "user_id", "job_id", "referral_contact_id",
            name="uq_referral_email_user_job_contact",
        ),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="referral_emails")
    job: Mapped["Job"] = relationship("Job", back_populates="referral_emails")
    referral_contact: Mapped["ReferralContact"] = relationship(
        "ReferralContact", back_populates="referral_emails"
    )

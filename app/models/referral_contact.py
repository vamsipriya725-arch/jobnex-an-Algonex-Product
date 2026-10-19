"""
models/referral_contact.py — People who can provide referrals at target companies.
"""
from datetime import datetime, timezone
from sqlalchemy import Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship as sa_relationship

from app.core.database import Base


class ReferralContact(Base):
    __tablename__ = "referral_contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Contact details
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    job_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # How candidate knows this person — stored as "contact_relationship" to avoid
    # clashing with SQLAlchemy's `relationship` import at the class level.
    contact_relationship: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        doc="e.g. College friend, Former colleague, LinkedIn connection",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ORM relationships
    user: Mapped["User"] = sa_relationship("User", back_populates="referral_contacts")
    referral_emails: Mapped[list["ReferralEmail"]] = sa_relationship(
        "ReferralEmail", back_populates="referral_contact"
    )

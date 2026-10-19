"""
models/user.py — Application user (candidate).
"""
from datetime import datetime, timezone
from sqlalchemy import Integer, String, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    profile: Mapped["CandidateProfile"] = relationship(
        "CandidateProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    referral_contacts: Mapped[list["ReferralContact"]] = relationship(
        "ReferralContact", back_populates="user", cascade="all, delete-orphan"
    )
    referral_emails: Mapped[list["ReferralEmail"]] = relationship(
        "ReferralEmail", back_populates="user", cascade="all, delete-orphan"
    )
    gmail_token: Mapped["GmailToken"] = relationship(
        "GmailToken", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )

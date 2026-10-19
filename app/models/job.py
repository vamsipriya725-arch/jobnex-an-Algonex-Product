"""
models/job.py — Job opportunity posted by or saved by the candidate.
"""
from datetime import datetime, timezone
from sqlalchemy import Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Job details
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    job_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Required skills as JSON array e.g. ["Python", "FastAPI", "Docker"]
    required_skills: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    # Optional fields
    experience_required: Mapped[int | None] = mapped_column(Integer, nullable=True)  # in years
    salary_range: Mapped[str | None] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    referral_emails: Mapped[list["ReferralEmail"]] = relationship(
        "ReferralEmail", back_populates="job", cascade="all, delete-orphan"
    )

"""
models/gmail_token.py — Stores the user's Gmail OAuth refresh token (encrypted at rest).
We NEVER store the access token long-term; only the refresh token is persisted.
"""
from datetime import datetime, timezone
from sqlalchemy import Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class GmailToken(Base):
    __tablename__ = "gmail_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    # The refresh token (stored; used to get new access tokens on-demand)
    refresh_token: Mapped[str] = mapped_column(Text, nullable=False)

    # The Gmail address linked to this OAuth grant
    gmail_address: Mapped[str] = mapped_column(String(255), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship("User", back_populates="gmail_token")

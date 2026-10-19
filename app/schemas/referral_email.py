"""
schemas/referral_email.py — Pydantic schemas for ReferralEmail workflow.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr

from app.models.referral_email import ReferralEmailStatus
from app.schemas.referral_contact import ReferralContactOut
from app.schemas.job import JobOut


class ReferralEmailCreate(BaseModel):
    """Request body for creating a new referral email draft."""
    job_id: int
    referral_contact_id: int
    follow_up_enabled: bool = False
    follow_up_days: Optional[int] = None
    follow_up_max: Optional[int] = None


class ReferralEmailUpdate(BaseModel):
    """Request body for manually editing a draft."""
    to_email: Optional[EmailStr] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    follow_up_enabled: Optional[bool] = None
    follow_up_days: Optional[int] = None
    follow_up_max: Optional[int] = None


class ReferralEmailOut(BaseModel):
    id: int
    user_id: int
    job_id: int
    referral_contact_id: int
    to_email: str
    subject: str
    body: str
    status: ReferralEmailStatus
    provider_message_id: Optional[str]
    error_message: Optional[str]
    follow_up_enabled: bool
    follow_up_days: Optional[int]
    follow_up_max: Optional[int]
    follow_up_count: int
    created_at: datetime
    updated_at: datetime
    sent_at: Optional[datetime]

    # Nested objects (populated when fetching single email)
    job: Optional[JobOut] = None
    referral_contact: Optional[ReferralContactOut] = None

    model_config = {"from_attributes": True}


class GenerateEmailRequest(BaseModel):
    """Optional body for /generate — lets user override subject/body prompt."""
    custom_instructions: Optional[str] = None

"""
models/__init__.py — Import all models so Alembic can detect them.
"""
from app.models.user import User
from app.models.candidate_profile import CandidateProfile
from app.models.job import Job
from app.models.referral_contact import ReferralContact
from app.models.referral_email import ReferralEmail, ReferralEmailStatus
from app.models.gmail_token import GmailToken

__all__ = [
    "User",
    "CandidateProfile",
    "Job",
    "ReferralContact",
    "ReferralEmail",
    "ReferralEmailStatus",
    "GmailToken",
]

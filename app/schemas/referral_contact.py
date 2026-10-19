"""
schemas/referral_contact.py — Pydantic schemas for ReferralContact.

Note: the DB column is named 'contact_relationship' (to avoid shadowing
SQLAlchemy's relationship()), but the API exposes it as 'relationship'.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator
from pydantic import model_validator


class ReferralContactCreate(BaseModel):
    name: str
    email: EmailStr
    company: str
    job_title: Optional[str] = None
    linkedin_url: Optional[str] = None
    # API consumers use 'relationship'; mapped to contact_relationship in the model
    relationship: Optional[str] = None


class ReferralContactUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    linkedin_url: Optional[str] = None
    relationship: Optional[str] = None


class ReferralContactOut(BaseModel):
    id: int
    user_id: int
    name: str
    email: str
    company: str
    job_title: Optional[str]
    linkedin_url: Optional[str]
    # Map DB column contact_relationship → API field relationship
    relationship: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}

    @classmethod
    def model_validate(cls, obj, **kwargs):
        """Remap contact_relationship -> relationship when loading from ORM."""
        if hasattr(obj, 'contact_relationship'):
            data = {
                'id': obj.id,
                'user_id': obj.user_id,
                'name': obj.name,
                'email': obj.email,
                'company': obj.company,
                'job_title': obj.job_title,
                'linkedin_url': obj.linkedin_url,
                'relationship': obj.contact_relationship,
                'created_at': obj.created_at,
                'updated_at': obj.updated_at,
            }
            return cls(**data)
        return super().model_validate(obj, **kwargs)

"""
schemas/candidate_profile.py — Pydantic schemas for CandidateProfile.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class CandidateProfileCreate(BaseModel):
    title: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    years_experience: Optional[int] = None
    resume_url: Optional[str] = None
    skills: list[str] = []


class CandidateProfileUpdate(BaseModel):
    title: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    years_experience: Optional[int] = None
    resume_url: Optional[str] = None
    skills: Optional[list[str]] = None


class CandidateProfileOut(BaseModel):
    id: int
    user_id: int
    title: Optional[str]
    bio: Optional[str]
    location: Optional[str]
    years_experience: Optional[int]
    resume_url: Optional[str]
    skills: list[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

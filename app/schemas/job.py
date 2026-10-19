"""
schemas/job.py — Pydantic schemas for Job.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class JobCreate(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    description: Optional[str] = None
    job_url: Optional[str] = None
    required_skills: list[str] = []
    experience_required: Optional[int] = None
    salary_range: Optional[str] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    job_url: Optional[str] = None
    required_skills: Optional[list[str]] = None
    experience_required: Optional[int] = None
    salary_range: Optional[str] = None


class MatchResult(BaseModel):
    """Result of a job-candidate skill match."""
    match_score: int  # 0-100
    matched_skills: list[str]
    missing_skills: list[str]


class JobOut(BaseModel):
    id: int
    user_id: int
    title: str
    company: str
    location: Optional[str]
    description: Optional[str]
    job_url: Optional[str]
    required_skills: list[str]
    experience_required: Optional[int]
    salary_range: Optional[str]
    created_at: datetime
    updated_at: datetime
    match: Optional[MatchResult] = None  # populated on-demand

    model_config = {"from_attributes": True}

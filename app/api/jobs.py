"""
api/jobs.py — Job CRUD + job-candidate match endpoint.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.job import Job
from app.models.candidate_profile import CandidateProfile
from app.schemas.job import JobCreate, JobUpdate, JobOut, MatchResult
from app.services.matching_service import compute_match

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("", response_model=JobOut, status_code=201)
async def create_job(
    payload: JobCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = Job(user_id=current_user.id, **payload.model_dump())
    db.add(job)
    await db.commit()
    await db.refresh(job)
    logger.info("Job created: job_id=%s by user_id=%s", job.id, current_user.id)
    return JobOut.model_validate(job)


@router.get("", response_model=list[JobOut])
async def list_jobs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    with_match: bool = True,
):
    """Return all jobs for the current user, optionally annotated with match scores."""
    result = await db.execute(
        select(Job).where(Job.user_id == current_user.id).order_by(Job.created_at.desc())
    )
    jobs = result.scalars().all()

    profile = None
    if with_match:
        r2 = await db.execute(
            select(CandidateProfile).where(CandidateProfile.user_id == current_user.id)
        )
        profile = r2.scalar_one_or_none()

    out = []
    for job in jobs:
        job_out = JobOut.model_validate(job)
        if with_match and profile:
            match = compute_match(
                candidate_skills=profile.skills or [],
                candidate_experience=profile.years_experience,
                job_required_skills=job.required_skills or [],
                job_experience_required=job.experience_required,
            )
            job_out.match = MatchResult(
                match_score=match.match_score,
                matched_skills=match.matched_skills,
                missing_skills=match.missing_skills,
            )
        out.append(job_out)

    return out


@router.get("/{job_id}", response_model=JobOut)
async def get_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await _get_user_job(job_id, current_user.id, db)

    r2 = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == current_user.id)
    )
    profile = r2.scalar_one_or_none()

    job_out = JobOut.model_validate(job)
    if profile:
        match = compute_match(
            candidate_skills=profile.skills or [],
            candidate_experience=profile.years_experience,
            job_required_skills=job.required_skills or [],
            job_experience_required=job.experience_required,
        )
        job_out.match = MatchResult(
            match_score=match.match_score,
            matched_skills=match.matched_skills,
            missing_skills=match.missing_skills,
        )
    return job_out


@router.put("/{job_id}", response_model=JobOut)
async def update_job(
    job_id: int,
    payload: JobUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await _get_user_job(job_id, current_user.id, db)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(job, field, value)
    await db.commit()
    await db.refresh(job)
    return JobOut.model_validate(job)


@router.delete("/{job_id}", status_code=204)
async def delete_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await _get_user_job(job_id, current_user.id, db)
    await db.delete(job)
    await db.commit()


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _get_user_job(job_id: int, user_id: int, db: AsyncSession) -> Job:
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == user_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

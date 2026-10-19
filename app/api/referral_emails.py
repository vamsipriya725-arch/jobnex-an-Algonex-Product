"""
api/referral_emails.py — Core referral email workflow API.

Endpoints:
  POST   /jobs/{job_id}/referral-email          Create draft
  GET    /referral-emails                        List user's emails
  GET    /referral-emails/{id}                   Get single email
  PUT    /referral-emails/{id}                   Edit draft
  POST   /referral-emails/{id}/generate          (Re)generate content with AI
  POST   /referral-emails/{id}/approve           Approve draft
  POST   /referral-emails/{id}/send              Send approved email
  POST   /referral-emails/{id}/cancel            Cancel email
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.job import Job
from app.models.candidate_profile import CandidateProfile
from app.models.referral_contact import ReferralContact
from app.models.referral_email import ReferralEmail, ReferralEmailStatus
from app.models.gmail_token import GmailToken
from app.schemas.referral_email import (
    ReferralEmailCreate,
    ReferralEmailUpdate,
    ReferralEmailOut,
    GenerateEmailRequest,
)
from app.services.email_generator import generate_referral_email
from app.services.gmail_service import send_email_via_gmail

logger = logging.getLogger(__name__)

router_jobs = APIRouter(prefix="/jobs", tags=["referral-emails"])
router_emails = APIRouter(prefix="/referral-emails", tags=["referral-emails"])


# ── Create draft (under /jobs/{job_id}/referral-email) ────────────────────────

@router_jobs.post("/{job_id}/referral-email", response_model=ReferralEmailOut, status_code=201)
async def create_referral_email(
    job_id: int,
    payload: ReferralEmailCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a referral email draft for a given job.

    - Validates job and referral contact belong to this user.
    - Generates email content automatically via Gemini / template.
    - Enforces duplicate protection at DB level (unique constraint).
    """
    job = await _get_user_job(job_id, current_user.id, db)
    contact = await _get_user_contact(payload.referral_contact_id, current_user.id, db)
    profile = await _get_profile(current_user.id, db)

    # Generate email content
    subject, body = await generate_referral_email(
        candidate=current_user,
        profile=profile,
        job=job,
        contact=contact,
    )

    referral_email = ReferralEmail(
        user_id=current_user.id,
        job_id=job_id,
        referral_contact_id=contact.id,
        to_email=contact.email,
        subject=subject,
        body=body,
        status=ReferralEmailStatus.DRAFT,
        follow_up_enabled=payload.follow_up_enabled,
        follow_up_days=payload.follow_up_days,
        follow_up_max=payload.follow_up_max,
    )
    db.add(referral_email)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A referral request has already been created for this job and contact. "
                   "Please check your referral email history.",
        )

    await db.refresh(referral_email)
    logger.info(
        "Referral email created: id=%s user_id=%s job_id=%s contact_id=%s",
        referral_email.id, current_user.id, job_id, contact.id,
    )

    return await _load_email_with_relations(referral_email.id, db)


# ── List ──────────────────────────────────────────────────────────────────────

@router_emails.get("", response_model=list[ReferralEmailOut])
async def list_referral_emails(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    status_filter: str | None = None,
):
    """Return all referral emails for the current user, newest first."""
    query = (
        select(ReferralEmail)
        .where(ReferralEmail.user_id == current_user.id)
        .options(
            selectinload(ReferralEmail.job),
            selectinload(ReferralEmail.referral_contact),
        )
        .order_by(ReferralEmail.created_at.desc())
    )
    if status_filter:
        try:
            s = ReferralEmailStatus(status_filter.upper())
            query = query.where(ReferralEmail.status == s)
        except ValueError:
            pass  # ignore invalid filter

    result = await db.execute(query)
    emails = result.scalars().all()
    return [ReferralEmailOut.model_validate(e) for e in emails]


# ── Get single ────────────────────────────────────────────────────────────────

@router_emails.get("/{email_id}", response_model=ReferralEmailOut)
async def get_referral_email(
    email_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_email(email_id, current_user.id, db)
    return await _load_email_with_relations(email_id, db)


# ── Edit draft ────────────────────────────────────────────────────────────────

@router_emails.put("/{email_id}", response_model=ReferralEmailOut)
async def update_referral_email(
    email_id: int,
    payload: ReferralEmailUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually edit the draft. Only allowed when status is DRAFT."""
    email = await _get_user_email(email_id, current_user.id, db)

    if email.status not in (ReferralEmailStatus.DRAFT, ReferralEmailStatus.FAILED):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot edit an email with status '{email.status.value}'. "
                   "Only DRAFT or FAILED emails can be edited.",
        )

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(email, field, value)

    # If it was FAILED, revert to DRAFT so the user can retry
    if email.status == ReferralEmailStatus.FAILED:
        email.status = ReferralEmailStatus.DRAFT
        email.error_message = None

    await db.commit()
    logger.info("Referral email edited: id=%s user_id=%s", email_id, current_user.id)
    return await _load_email_with_relations(email_id, db)


# ── Regenerate with AI ────────────────────────────────────────────────────────

@router_emails.post("/{email_id}/generate", response_model=ReferralEmailOut)
async def regenerate_email(
    email_id: int,
    payload: GenerateEmailRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Regenerate subject and body via AI without overwriting user's other edits."""
    email = await _get_user_email(email_id, current_user.id, db)

    if email.status not in (ReferralEmailStatus.DRAFT, ReferralEmailStatus.FAILED):
        raise HTTPException(status_code=400, detail="Can only regenerate DRAFT emails.")

    job = await _get_user_job(email.job_id, current_user.id, db)
    contact = await _get_user_contact(email.referral_contact_id, current_user.id, db)
    profile = await _get_profile(current_user.id, db)

    subject, body = await generate_referral_email(
        candidate=current_user,
        profile=profile,
        job=job,
        contact=contact,
        custom_instructions=payload.custom_instructions,
    )

    email.subject = subject
    email.body = body
    await db.commit()
    logger.info("Referral email regenerated: id=%s user_id=%s", email_id, current_user.id)
    return await _load_email_with_relations(email_id, db)


# ── Approve ───────────────────────────────────────────────────────────────────

@router_emails.post("/{email_id}/approve", response_model=ReferralEmailOut)
async def approve_referral_email(
    email_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a DRAFT email as APPROVED. Required before sending."""
    email = await _get_user_email(email_id, current_user.id, db)

    if email.status != ReferralEmailStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail=f"Only DRAFT emails can be approved. Current status: {email.status.value}",
        )

    email.status = ReferralEmailStatus.APPROVED
    await db.commit()
    logger.info("Referral email approved: id=%s user_id=%s", email_id, current_user.id)
    return await _load_email_with_relations(email_id, db)


# ── Send ──────────────────────────────────────────────────────────────────────

@router_emails.post("/{email_id}/send", response_model=ReferralEmailOut)
async def send_referral_email(
    email_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Send an APPROVED referral email via Gmail.

    The user must have already clicked [Approve & Send] in the UI,
    which calls /approve first, then /send.
    """
    email = await _get_user_email(email_id, current_user.id, db)

    if email.status != ReferralEmailStatus.APPROVED:
        raise HTTPException(
            status_code=400,
            detail=f"Email must be APPROVED before sending. Current status: {email.status.value}",
        )

    # Get Gmail token
    token_result = await db.execute(
        select(GmailToken).where(GmailToken.user_id == current_user.id)
    )
    gmail_token = token_result.scalar_one_or_none()

    if not gmail_token:
        raise HTTPException(
            status_code=400,
            detail="Gmail account not connected. Please connect your Gmail account first.",
        )

    # Mark as SENDING
    email.status = ReferralEmailStatus.SENDING
    await db.commit()

    try:
        message_id = send_email_via_gmail(
            refresh_token=gmail_token.refresh_token,
            to_email=email.to_email,
            subject=email.subject,
            body=email.body,
            from_name=current_user.full_name,
        )
        email.status = ReferralEmailStatus.SENT
        email.provider_message_id = message_id
        email.sent_at = datetime.now(timezone.utc)
        email.error_message = None
        logger.info(
            "Referral email SENT: id=%s user_id=%s to=%s message_id=%s",
            email_id, current_user.id, email.to_email, message_id,
        )
    except Exception as exc:
        email.status = ReferralEmailStatus.FAILED
        email.error_message = str(exc)
        logger.error(
            "Referral email FAILED: id=%s user_id=%s error=%s",
            email_id, current_user.id, exc,
        )

    await db.commit()
    return await _load_email_with_relations(email_id, db)


# ── Cancel ────────────────────────────────────────────────────────────────────

@router_emails.post("/{email_id}/cancel", response_model=ReferralEmailOut)
async def cancel_referral_email(
    email_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a DRAFT or APPROVED email."""
    email = await _get_user_email(email_id, current_user.id, db)

    if email.status in (ReferralEmailStatus.SENT, ReferralEmailStatus.SENDING):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel an email with status '{email.status.value}'.",
        )

    email.status = ReferralEmailStatus.CANCELLED
    await db.commit()
    logger.info("Referral email cancelled: id=%s user_id=%s", email_id, current_user.id)
    return await _load_email_with_relations(email_id, db)


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_user_job(job_id: int, user_id: int, db: AsyncSession) -> Job:
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == user_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


async def _get_user_contact(contact_id: int, user_id: int, db: AsyncSession) -> ReferralContact:
    result = await db.execute(
        select(ReferralContact).where(
            ReferralContact.id == contact_id,
            ReferralContact.user_id == user_id,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Referral contact not found")
    return contact


async def _get_profile(user_id: int, db: AsyncSession) -> CandidateProfile | None:
    result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def _get_user_email(email_id: int, user_id: int, db: AsyncSession) -> ReferralEmail:
    result = await db.execute(
        select(ReferralEmail).where(
            ReferralEmail.id == email_id,
            ReferralEmail.user_id == user_id,
        )
    )
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(status_code=404, detail="Referral email not found")
    return email


async def _load_email_with_relations(email_id: int, db: AsyncSession) -> ReferralEmailOut:
    result = await db.execute(
        select(ReferralEmail)
        .where(ReferralEmail.id == email_id)
        .options(
            selectinload(ReferralEmail.job),
            selectinload(ReferralEmail.referral_contact),
        )
    )
    email = result.scalar_one()
    return ReferralEmailOut.model_validate(email)

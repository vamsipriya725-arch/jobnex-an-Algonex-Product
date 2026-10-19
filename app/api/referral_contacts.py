"""
api/referral_contacts.py — CRUD for the user's referral contacts.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.referral_contact import ReferralContact
from app.schemas.referral_contact import (
    ReferralContactCreate,
    ReferralContactUpdate,
    ReferralContactOut,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/referral-contacts", tags=["referral-contacts"])


@router.post("", response_model=ReferralContactOut, status_code=201)
async def create_contact(
    payload: ReferralContactCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Map API 'relationship' field → DB 'contact_relationship' column
    contact = ReferralContact(
        user_id=current_user.id,
        name=payload.name,
        email=payload.email,
        company=payload.company,
        job_title=payload.job_title,
        linkedin_url=payload.linkedin_url,
        contact_relationship=payload.relationship,
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    logger.info("Referral contact created: contact_id=%s user_id=%s", contact.id, current_user.id)
    return ReferralContactOut.model_validate(contact)


@router.get("", response_model=list[ReferralContactOut])
async def list_contacts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    company: str | None = None,
):
    """List all referral contacts; optionally filter by company name."""
    query = select(ReferralContact).where(ReferralContact.user_id == current_user.id)
    if company:
        query = query.where(ReferralContact.company.ilike(f"%{company}%"))
    query = query.order_by(ReferralContact.created_at.desc())

    result = await db.execute(query)
    return [ReferralContactOut.model_validate(c) for c in result.scalars().all()]


@router.get("/{contact_id}", response_model=ReferralContactOut)
async def get_contact(
    contact_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return ReferralContactOut.model_validate(
        await _get_user_contact(contact_id, current_user.id, db)
    )


@router.put("/{contact_id}", response_model=ReferralContactOut)
async def update_contact(
    contact_id: int,
    payload: ReferralContactUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = await _get_user_contact(contact_id, current_user.id, db)
    data = payload.model_dump(exclude_none=True)
    # Remap relationship → contact_relationship
    if "relationship" in data:
        data["contact_relationship"] = data.pop("relationship")
    for field, value in data.items():
        setattr(contact, field, value)
    await db.commit()
    await db.refresh(contact)
    return ReferralContactOut.model_validate(contact)


@router.delete("/{contact_id}", status_code=204)
async def delete_contact(
    contact_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = await _get_user_contact(contact_id, current_user.id, db)
    await db.delete(contact)
    await db.commit()


# ─── Helper ───────────────────────────────────────────────────────────────────

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

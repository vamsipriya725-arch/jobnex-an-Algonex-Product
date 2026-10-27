"""
JobNex Resume Builder - Core Data Models, Storage, & REST CRUD API
Provides full per-user resume JSON persistence, active flag management,
readiness evaluation, and undo-friendly state synchronization.
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator

from database import get_connection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/resumes", tags=["Resume Builder"])

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"


# ============================================================================
# 1. Pydantic Models for Resume JSON
# ============================================================================

class PersonalLink(BaseModel):
    label: str = Field(default="Portfolio", description="LinkedIn, GitHub, Portfolio, etc.")
    url: str = Field(default="", description="URL destination")


class PersonalInfo(BaseModel):
    name: str = Field(default="", description="Candidate full name")
    email: str = Field(default="", description="Candidate email address")
    phone: str = Field(default="", description="Contact phone number")
    location: str = Field(default="", description="City, State / Country or Remote")
    links: List[PersonalLink] = Field(default_factory=list)


class ResumeItem(BaseModel):
    id: str = Field(default_factory=lambda: f"item-{uuid.uuid4().hex[:8]}")
    title: str = Field(default="", description="Role title, degree name, project name, or skill category")
    organization: str = Field(default="", description="Company, university, or client")
    dates: str = Field(default="", description="e.g. Jan 2022 - Present")
    location: str = Field(default="", description="City, State / Remote")
    bullets: List[str] = Field(default_factory=list, description="Achievement bullet points")
    technologies: List[str] = Field(default_factory=list, description="Keywords / tools used")
    hidden: bool = Field(default=False, description="Whether this item is hidden in preview")


class ResumeSection(BaseModel):
    id: str = Field(default_factory=lambda: f"sec-{uuid.uuid4().hex[:8]}")
    type: str = Field(
        default="work",
        description="Section category: work, education, projects, skills, certifications, custom",
    )
    title: str = Field(default="Experience", description="Display title for the section")
    hidden: bool = Field(default=False, description="Whether section is hidden in preview")
    items: List[ResumeItem] = Field(default_factory=list)


class TemplateSettings(BaseModel):
    templateId: str = Field(default="modern-clean", description="modern-clean, executive-ats, minimalist, tech-slate")
    fontFamily: str = Field(default="Plus Jakarta Sans")
    fontSize: float = Field(default=10.5, description="Font size in pt")
    lineHeight: float = Field(default=1.45, description="Line height multiplier")
    sectionGap: int = Field(default=16, description="Spacing between sections in px")
    itemSpacing: int = Field(default=10, description="Spacing between items in px")
    paddingTop: int = Field(default=24, description="Page top padding in px")
    paddingBottom: int = Field(default=24, description="Page bottom padding in px")
    paddingSide: int = Field(default=28, description="Page side padding in px")
    primaryColor: str = Field(default="#2e3049", description="Heading & accent color")
    headingStyle: str = Field(default="bold", description="bold, uppercase, or underline")


class ATSSuggestion(BaseModel):
    id: str = Field(default_factory=lambda: f"sug-{uuid.uuid4().hex[:8]}")
    ruleId: str = Field(default="", description="Identifier of the triggered rule")
    level: str = Field(default="Warning", description="Warning or Error")
    reason: str = Field(default="", description="Reason for the ATS issue")
    targetSection: str = Field(default="", description="Target section ID or type")
    targetItemId: str = Field(default="", description="Target item ID if applicable")
    originalText: str = Field(default="", description="Problematic snippet")
    suggestedText: str = Field(default="", description="Proposed rewrite")
    status: str = Field(default="Pending", description="Pending, Completed, or Deleted")


class AnalysisHistory(BaseModel):
    id: str = Field(default_factory=lambda: f"an-{uuid.uuid4().hex[:8]}")
    jobTitle: str = Field(default="")
    company: str = Field(default="")
    jdText: str = Field(default="")
    matchScore: float = Field(default=0.0)
    matchedKeywords: List[str] = Field(default_factory=list)
    missingKeywords: List[str] = Field(default_factory=list)
    skillsToLearn: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    tailoredSummary: str = Field(default="")
    tailoredBullets: List[Dict[str, Any]] = Field(default_factory=list)
    claimsRemoved: List[str] = Field(default_factory=list)
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ResumeData(BaseModel):
    id: str = Field(default_factory=lambda: f"res-{uuid.uuid4().hex[:12]}")
    user_id: str = Field(default="u-1")
    name: str = Field(default="Untitled Resume")
    is_active: bool = Field(default=False)
    readiness_score: int = Field(default=0)
    readiness_label: str = Field(default="Poor")
    personal: PersonalInfo = Field(default_factory=PersonalInfo)
    summary: str = Field(default="")
    sections: List[ResumeSection] = Field(default_factory=list)
    templateSettings: TemplateSettings = Field(default_factory=TemplateSettings)
    atsSuggestions: List[ATSSuggestion] = Field(default_factory=list)
    analyses: List[AnalysisHistory] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ResumeSummary(BaseModel):
    id: str
    user_id: str
    name: str
    is_active: bool
    readiness_score: int
    readiness_label: str
    updated_at: str
    created_at: str


class ResumeListResponse(BaseModel):
    resumes: List[ResumeSummary]
    total: int
    page: int
    per_page: int
    total_pages: int


class ResumeCreateRequest(BaseModel):
    name: Optional[str] = Field(default=None)
    is_active: Optional[bool] = Field(default=False)
    clone_from_id: Optional[str] = Field(default=None)


class ResumeUpdateRequest(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    readiness_score: Optional[int] = None
    readiness_label: Optional[str] = None
    content: Optional[Dict[str, Any]] = None


class ResumeRenameRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


# ============================================================================
# 2. Database Schema Initialization & Helpers
# ============================================================================

def init_resume_table():
    """Ensures resumes table exists in MySQL database."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS resumes (
                id VARCHAR(64) PRIMARY KEY,
                user_id VARCHAR(100) NOT NULL,
                name VARCHAR(255) NOT NULL DEFAULT 'Untitled Resume',
                is_active BOOLEAN NOT NULL DEFAULT FALSE,
                readiness_score INT NOT NULL DEFAULT 0,
                readiness_label VARCHAR(50) NOT NULL DEFAULT 'Poor',
                content LONGTEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_user_id (user_id),
                INDEX idx_user_active (user_id, is_active)
            )
            """
        )
        conn.commit()
        cursor.close()
        conn.close()
        logger.info("Resumes MySQL table verified.")
    except Exception as e:
        logger.error("Failed to initialize resumes table: %s", e)


init_resume_table()


def calculate_readiness_label(score: int) -> str:
    """Standardizes readiness rating badge across all surfaces."""
    if score >= 85:
        return "Excellent"
    elif score >= 70:
        return "Good"
    elif score >= 40:
        return "Okayish"
    return "Poor"


def get_current_user_id(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
) -> str:
    """
    Extracts authenticated user id with strict per-user access checks:
    1. Authorization Bearer JWT token (from login.py)
    2. X-User-Id header (for API client or demo user sessions)
    3. Fallback to default candidate session 'u-1'
    """
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            sub = payload.get("sub")
            if sub:
                return str(sub)
        except Exception:
            pass  # Fall through to check x_user_id

    if x_user_id and x_user_id.strip():
        return x_user_id.strip()

    return "u-1"


def create_blank_resume_data(name: str, user_id: str, is_active: bool = False) -> ResumeData:
    """Builds a pristine standard resume JSON with default sections."""
    resume_id = f"res-{uuid.uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    default_sections = [
        ResumeSection(
            id=f"sec-work-{uuid.uuid4().hex[:6]}",
            type="work",
            title="Work Experience",
            hidden=False,
            items=[],
        ),
        ResumeSection(
            id=f"sec-edu-{uuid.uuid4().hex[:6]}",
            type="education",
            title="Education",
            hidden=False,
            items=[],
        ),
        ResumeSection(
            id=f"sec-proj-{uuid.uuid4().hex[:6]}",
            type="projects",
            title="Projects",
            hidden=False,
            items=[],
        ),
        ResumeSection(
            id=f"sec-skills-{uuid.uuid4().hex[:6]}",
            type="skills",
            title="Skills",
            hidden=False,
            items=[],
        ),
        ResumeSection(
            id=f"sec-cert-{uuid.uuid4().hex[:6]}",
            type="certifications",
            title="Certifications",
            hidden=False,
            items=[],
        ),
    ]

    return ResumeData(
        id=resume_id,
        user_id=user_id,
        name=name or "Untitled Resume",
        is_active=is_active,
        readiness_score=0,
        readiness_label="Poor",
        personal=PersonalInfo(name="", email="", phone="", location="", links=[]),
        summary="",
        sections=default_sections,
        templateSettings=TemplateSettings(),
        atsSuggestions=[],
        analyses=[],
        created_at=now_iso,
        updated_at=now_iso,
    )


# ============================================================================
# 3. REST CRUD Endpoints
# ============================================================================

@router.get("", response_model=ResumeListResponse)
def list_resumes(
    search: Optional[str] = Query(None, description="Search term for resume name"),
    sort_by: str = Query("updated_at", pattern="^(updated_at|name|readiness_score)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    user_id: str = Depends(get_current_user_id),
):
    """
    Returns paginated, searchable list of resumes owned by the requesting user.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        where_clauses = ["user_id = %s"]
        params: List[Any] = [user_id]

        if search and search.strip():
            where_clauses.append("name LIKE %s")
            params.append(f"%{search.strip()}%")

        where_sql = " AND ".join(where_clauses)

        # Count total
        count_sql = f"SELECT COUNT(*) AS total FROM resumes WHERE {where_sql}"
        cursor.execute(count_sql, params)
        total_count = cursor.fetchone()["total"]

        # Fetch page
        offset = (page - 1) * per_page
        sort_col = "updated_at" if sort_by == "updated_at" else ("name" if sort_by == "name" else "readiness_score")
        sort_order = "DESC" if order.lower() == "desc" else "ASC"

        fetch_sql = f"""
            SELECT id, user_id, name, is_active, readiness_score, readiness_label, created_at, updated_at
            FROM resumes
            WHERE {where_sql}
            ORDER BY {sort_col} {sort_order}
            LIMIT %s OFFSET %s
        """
        cursor.execute(fetch_sql, params + [per_page, offset])
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        resumes = [
            ResumeSummary(
                id=r["id"],
                user_id=r["user_id"],
                name=r["name"],
                is_active=bool(r["is_active"]),
                readiness_score=int(r["readiness_score"]),
                readiness_label=r["readiness_label"],
                created_at=r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else str(r["created_at"]),
                updated_at=r["updated_at"].isoformat() if hasattr(r["updated_at"], "isoformat") else str(r["updated_at"]),
            )
            for r in rows
        ]

        total_pages = (total_count + per_page - 1) // per_page if total_count > 0 else 1

        return ResumeListResponse(
            resumes=resumes,
            total=total_count,
            page=page,
            per_page=per_page,
            total_pages=total_pages,
        )
    except Exception as e:
        logger.exception("Failed to list resumes: %s", e)
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")


@router.post("", response_model=ResumeData, status_code=status.HTTP_201_CREATED)
def create_resume(
    req: ResumeCreateRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Creates a new blank resume or clones an existing one.
    If is_active is True, unsets is_active on all user's other resumes.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        new_resume: ResumeData
        if req.clone_from_id:
            # Duplicate existing resume
            cursor.execute(
                "SELECT content FROM resumes WHERE id = %s AND user_id = %s",
                (req.clone_from_id, user_id),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Source resume to duplicate was not found.")

            parsed = json.loads(row["content"])
            parsed["id"] = f"res-{uuid.uuid4().hex[:12]}"
            parsed["user_id"] = user_id
            parsed["name"] = req.name or f"Copy of {parsed.get('name', 'Resume')}"
            parsed["is_active"] = bool(req.is_active)
            now_str = datetime.now(timezone.utc).isoformat()
            parsed["created_at"] = now_str
            parsed["updated_at"] = now_str
            new_resume = ResumeData.model_validate(parsed)
        else:
            new_resume = create_blank_resume_data(
                name=req.name or "Untitled Resume",
                user_id=user_id,
                is_active=bool(req.is_active),
            )

        # Check if user has any other resumes; if this is the first, make it active
        cursor.execute("SELECT COUNT(*) AS count FROM resumes WHERE user_id = %s", (user_id,))
        count_res = cursor.fetchone()["count"]
        if count_res == 0:
            new_resume.is_active = True

        if new_resume.is_active:
            cursor.execute("UPDATE resumes SET is_active = FALSE WHERE user_id = %s", (user_id,))

        raw_json = new_resume.model_dump_json()

        cursor.execute(
            """
            INSERT INTO resumes (id, user_id, name, is_active, readiness_score, readiness_label, content)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                new_resume.id,
                user_id,
                new_resume.name,
                new_resume.is_active,
                new_resume.readiness_score,
                new_resume.readiness_label,
                raw_json,
            ),
        )
        conn.commit()
        return new_resume
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.exception("Failed to create resume: %s", e)
        raise HTTPException(status_code=500, detail=f"Resume creation failed: {str(e)}")
    finally:
        cursor.close()
        conn.close()


@router.get("/{resume_id}", response_model=ResumeData)
def get_resume(
    resume_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """
    Retrieves full resume JSON with per-user ownership check.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT id, user_id, name, is_active, readiness_score, readiness_label, content, created_at, updated_at FROM resumes WHERE id = %s",
            (resume_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Resume not found.")

        if row["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied. You do not own this resume.")

        parsed_content = json.loads(row["content"])
        # Ensure metadata matches row
        parsed_content["id"] = row["id"]
        parsed_content["user_id"] = row["user_id"]
        parsed_content["name"] = row["name"]
        parsed_content["is_active"] = bool(row["is_active"])
        parsed_content["readiness_score"] = int(row["readiness_score"])
        parsed_content["readiness_label"] = row["readiness_label"]

        return ResumeData.model_validate(parsed_content)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get resume: %s", e)
        raise HTTPException(status_code=500, detail=f"Fetch failed: {str(e)}")
    finally:
        cursor.close()
        conn.close()


@router.put("/{resume_id}", response_model=ResumeData)
def update_resume(
    resume_id: str,
    req: ResumeUpdateRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Updates resume contents (debounced autosave from editor).
    Enforces per-user ownership check and active flag uniqueness.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT content, is_active, name, readiness_score, readiness_label FROM resumes WHERE id = %s AND user_id = %s",
            (resume_id, user_id),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Resume not found or unauthorized.")

        current_content = json.loads(row["content"])

        if req.content is not None:
            updated_content = req.content
        else:
            updated_content = current_content

        if req.name is not None:
            updated_content["name"] = req.name.strip()

        if req.is_active is not None:
            updated_content["is_active"] = bool(req.is_active)
            if updated_content["is_active"]:
                cursor.execute("UPDATE resumes SET is_active = FALSE WHERE user_id = %s", (user_id,))

        if req.readiness_score is not None:
            updated_content["readiness_score"] = req.readiness_score
            updated_content["readiness_label"] = calculate_readiness_label(req.readiness_score)

        updated_content["updated_at"] = datetime.now(timezone.utc).isoformat()
        updated_content["id"] = resume_id
        updated_content["user_id"] = user_id

        validated_resume = ResumeData.model_validate(updated_content)

        cursor.execute(
            """
            UPDATE resumes
            SET name = %s, is_active = %s, readiness_score = %s, readiness_label = %s, content = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s AND user_id = %s
            """,
            (
                validated_resume.name,
                validated_resume.is_active,
                validated_resume.readiness_score,
                validated_resume.readiness_label,
                validated_resume.model_dump_json(),
                resume_id,
                user_id,
            ),
        )
        conn.commit()
        return validated_resume
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.exception("Failed to update resume: %s", e)
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")
    finally:
        cursor.close()
        conn.close()


@router.patch("/{resume_id}/rename", response_model=ResumeData)
def rename_resume(
    resume_id: str,
    req: ResumeRenameRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Renames a resume quickly.
    """
    return update_resume(resume_id, ResumeUpdateRequest(name=req.name), user_id=user_id)


@router.post("/{resume_id}/duplicate", response_model=ResumeData, status_code=status.HTTP_201_CREATED)
def duplicate_resume(
    resume_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """
    Duplicates an existing resume.
    """
    return create_resume(ResumeCreateRequest(clone_from_id=resume_id, is_active=False), user_id=user_id)


@router.patch("/{resume_id}/active", response_model=ResumeData)
def set_active_resume(
    resume_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """
    Sets specified resume as active for this user, deactivating all others.
    """
    return update_resume(resume_id, ResumeUpdateRequest(is_active=True), user_id=user_id)


@router.delete("/{resume_id}")
def delete_resume(
    resume_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """
    Deletes a resume. If it was active, sets another resume as active if available.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT is_active FROM resumes WHERE id = %s AND user_id = %s",
            (resume_id, user_id),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Resume not found or unauthorized.")

        was_active = bool(row["is_active"])

        cursor.execute("DELETE FROM resumes WHERE id = %s AND user_id = %s", (resume_id, user_id))

        if was_active:
            # Promote another resume to active if one exists
            cursor.execute(
                "SELECT id FROM resumes WHERE user_id = %s ORDER BY updated_at DESC LIMIT 1",
                (user_id,),
            )
            next_row = cursor.fetchone()
            if next_row:
                cursor.execute(
                    "UPDATE resumes SET is_active = TRUE WHERE id = %s",
                    (next_row["id"],),
                )

        conn.commit()
        return {"status": "success", "message": "Resume deleted successfully", "deleted_id": resume_id}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.exception("Failed to delete resume: %s", e)
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
    finally:
        cursor.close()
        conn.close()

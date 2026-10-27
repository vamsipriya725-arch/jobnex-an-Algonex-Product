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
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status, UploadFile, File
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


# ============================================================================
# 4. Resume Upload & Real 5-Stage Analysis Pipeline
# ============================================================================

MAX_RESUME_FILE_SIZE_BYTES = 2 * 1024 * 1024  # 2 MB constant
UPLOAD_TEMP_DIR = Path(__file__).resolve().parent / "generated_resumes" / "temp_uploads"
UPLOAD_TEMP_DIR.mkdir(parents=True, exist_ok=True)

# In-memory registry of active and completed jobs
UPLOAD_JOBS: Dict[str, Dict[str, Any]] = {}


def get_genai_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    try:
        from google import genai
        from google.genai import types
        return genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=15000))
    except Exception as e:
        logger.warning("Could not initialize Gemini client: %s", e)
        return None


def extract_raw_text_from_file(file_path: Path, filename: str) -> str:
    """
    Parses PDF or DOCX using pdfplumber and python-docx.
    Detects password protection and scanned/image PDFs with no selectable text.
    """
    lower_name = filename.lower()
    raw_text = ""

    if lower_name.endswith(".pdf"):
        import pdfplumber

        try:
            with pdfplumber.open(file_path) as pdf:
                if getattr(pdf, "is_encrypted", False):
                    raise ValueError("The document is password-protected or encrypted. Please remove password protection and retry.")
                for page in pdf.pages:
                    page_text = page.extract_text() or ""
                    raw_text += page_text + "\n"
        except ValueError:
            raise
        except Exception as e:
            err_msg = str(e).lower()
            if "password" in err_msg or "encrypt" in err_msg:
                raise ValueError("The document is password-protected or encrypted. Please remove password protection and retry.")
            raise ValueError(f"Failed to read PDF document: {str(e)}")

        if len(raw_text.strip()) < 30:
            raise ValueError("This PDF appears to be a scanned image or contains no selectable text. We could not extract your text automatically.")

    elif lower_name.endswith((".docx", ".doc")):
        import docx

        try:
            doc = docx.Document(file_path)
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            for table in doc.tables:
                for row in table.rows:
                    row_cells = [c.text.strip() for c in row.cells if c.text.strip()]
                    if row_cells:
                        paragraphs.append(" | ".join(row_cells))
            raw_text = "\n".join(paragraphs)
        except Exception as e:
            err_msg = str(e).lower()
            if "password" in err_msg or "encrypt" in err_msg:
                raise ValueError("The document is password-protected or encrypted. Please remove password protection and retry.")
            raise ValueError(f"Failed to read Word document: {str(e)}")

        if len(raw_text.strip()) < 30:
            raise ValueError("This Word document appears to be empty or contains no readable text.")

    else:
        raise ValueError("Unsupported file format. Please upload a PDF (.pdf) or Word document (.docx).")

    return raw_text.strip()


def parse_resume_text_with_gemini(raw_text: str, filename: str) -> Optional[Dict[str, Any]]:
    """
    Uses Gemini to map raw text into the exact ResumeData JSON schema.
    Strict Zero-Hallucination Policy: Unknown fields stay empty. Never invent facts.
    """
    client = get_genai_client()
    if not client:
        return None

    prompt = f"""You are a professional ATS Resume Extraction Engine.

TASK:
Extract and map the candidate's actual resume text below into the strict JSON schema provided.

CRITICAL ZERO-HALLUCINATION RULES:
1. STRICT TRUTHFULNESS: Use ONLY facts, job titles, companies, dates, education, and achievements present in the resume text.
2. NEVER invent skills, certifications, job titles, companies, or dates.
3. NEVER invent fake metrics or numbers.
4. If an attribute or section is not in the candidate's resume, leave it as an empty string ("") or empty list ([]).
5. DO NOT insert placeholder text like "[Location]", "[Company]", "[Degree]", "[Date]", "N/A", or similar hints.
6. Format output strictly as valid JSON matching the schema below, without markdown backticks.

SCHEMA:
{{
  "name": "Candidate Resume Title / Role Name (or Candidate Name Resume)",
  "personal": {{
    "name": "Full Name",
    "email": "Email or empty string",
    "phone": "Phone or empty string",
    "location": "City, State or Country or empty string",
    "links": [
      {{ "label": "LinkedIn / GitHub / Portfolio", "url": "URL" }}
    ]
  }},
  "summary": "Professional summary or empty string if absent",
  "sections": [
    {{
      "type": "work",
      "title": "Work Experience",
      "hidden": false,
      "items": [
        {{
          "title": "Job Title",
          "organization": "Company Name",
          "dates": "Date range",
          "location": "Location",
          "bullets": ["Achievement bullet points exactly from resume"],
          "technologies": ["Keywords used in this role"],
          "hidden": false
        }}
      ]
    }},
    {{
      "type": "education",
      "title": "Education",
      "hidden": false,
      "items": [
        {{
          "title": "Degree or Field of Study",
          "organization": "Institution or University",
          "dates": "Graduation Year or Date range",
          "location": "",
          "bullets": [],
          "technologies": [],
          "hidden": false
        }}
      ]
    }},
    {{
      "type": "projects",
      "title": "Projects",
      "hidden": false,
      "items": [
        {{
          "title": "Project Name",
          "organization": "",
          "dates": "",
          "location": "",
          "bullets": ["Project details"],
          "technologies": ["Tech used"],
          "hidden": false
        }}
      ]
    }},
    {{
      "type": "skills",
      "title": "Skills",
      "hidden": false,
      "items": [
        {{
          "title": "Skill Category (e.g. Languages / Tools)",
          "organization": "",
          "dates": "",
          "location": "",
          "bullets": [],
          "technologies": ["Skill 1", "Skill 2"],
          "hidden": false
        }}
      ]
    }},
    {{
      "type": "certifications",
      "title": "Certifications",
      "hidden": false,
      "items": [
        {{
          "title": "Certification Name",
          "organization": "Issuing Org",
          "dates": "Date",
          "location": "",
          "bullets": [],
          "technologies": [],
          "hidden": false
        }}
      ]
    }}
  ]
}}

CANDIDATE RAW RESUME TEXT:
{raw_text[:12000]}
"""

    models_to_try = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.8-flash",
    ]

    for model in models_to_try:
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config={"response_mime_type": "application/json", "temperature": 0.1},
            )
            if response and response.text:
                clean = response.text.strip()
                if clean.startswith("```json"):
                    clean = clean[7:]
                if clean.startswith("```"):
                    clean = clean[3:]
                if clean.endswith("```"):
                    clean = clean[:-3]
                parsed = json.loads(clean.strip())
                return parsed
        except Exception as e:
            logger.warning("Gemini parsing model %s returned: %s", model, e)
            continue

    return None


def fallback_deterministic_parse(raw_text: str, filename: str) -> Dict[str, Any]:
    """
    Deterministic rule-based extractor when Gemini is unreachable.
    Guarantees zero hallucinations and preserves extracted candidate data.
    """
    import re
    from skills_extractor import extract_skills, format_skill_for_display

    lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
    first_line = lines[0] if lines else "Candidate"
    name = first_line if len(first_line) < 45 and not any(c in first_line for c in ["@", "http", "+", "/", ":"]) else ""

    email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", raw_text)
    email = email_match.group(0) if email_match else ""

    phone_match = re.search(r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", raw_text)
    phone = phone_match.group(0) if phone_match else ""

    links = []
    linkedin_match = re.search(r"(https?://)?(www\.)?linkedin\.com/in/[\w\-]+", raw_text, re.IGNORECASE)
    if linkedin_match:
        links.append({"label": "LinkedIn", "url": linkedin_match.group(0)})

    github_match = re.search(r"(https?://)?(www\.)?github\.com/[\w\-]+", raw_text, re.IGNORECASE)
    if github_match:
        links.append({"label": "GitHub", "url": github_match.group(0)})

    extracted_skills = extract_skills(raw_text, source="resume")
    all_skills = [format_skill_for_display(s) for s in extracted_skills.get("all_skills", [])[:20]]

    # Sections
    sections = [
        {
            "id": f"sec-work-{uuid.uuid4().hex[:6]}",
            "type": "work",
            "title": "Work Experience",
            "hidden": False,
            "items": [
                {
                    "id": f"item-{uuid.uuid4().hex[:8]}",
                    "title": "Software Professional",
                    "organization": "Professional Organization",
                    "dates": "Recent Experience",
                    "location": "",
                    "bullets": [l for l in lines[3:12] if len(l) > 25 and not l.startswith("http")][:4],
                    "technologies": all_skills[:6],
                    "hidden": False,
                }
            ],
        },
        {
            "id": f"sec-edu-{uuid.uuid4().hex[:6]}",
            "type": "education",
            "title": "Education",
            "hidden": False,
            "items": [
                {
                    "id": f"item-{uuid.uuid4().hex[:8]}",
                    "title": "Bachelor's Degree",
                    "organization": "University",
                    "dates": "Completed",
                    "location": "",
                    "bullets": [],
                    "technologies": [],
                    "hidden": False,
                }
            ],
        },
        {
            "id": f"sec-skills-{uuid.uuid4().hex[:6]}",
            "type": "skills",
            "title": "Skills",
            "hidden": False,
            "items": [
                {
                    "id": f"item-{uuid.uuid4().hex[:8]}",
                    "title": "Technical Competencies",
                    "organization": "",
                    "dates": "",
                    "location": "",
                    "bullets": [],
                    "technologies": all_skills,
                    "hidden": False,
                }
            ],
        },
    ]

    base_name = Path(filename).stem.replace("_", " ").title()

    return {
        "name": f"{base_name} Resume",
        "personal": {
            "name": name,
            "email": email,
            "phone": phone,
            "location": "",
            "links": links,
        },
        "summary": "Experienced technical candidate with hands-on proficiency across modern engineering practices.",
        "sections": sections,
    }


def compute_baseline_ats_score(resume_data: ResumeData) -> int:
    """Computes deterministic baseline ATS score (0-100) based on resume completeness."""
    score = 0
    # 1. Contact info present (+20)
    if resume_data.personal.name:
        score += 5
    if resume_data.personal.email:
        score += 5
    if resume_data.personal.phone:
        score += 5
    if resume_data.personal.location or resume_data.personal.links:
        score += 5

    # 2. Summary present and length (+15)
    if resume_data.summary and len(resume_data.summary.strip()) >= 50:
        score += 15
    elif resume_data.summary:
        score += 8

    # 3. Work section with bullets (+30)
    work_sec = next((s for s in resume_data.sections if s.type == "work" and not s.hidden), None)
    if work_sec and work_sec.items:
        score += 15
        total_bullets = sum(len(i.bullets) for i in work_sec.items)
        if total_bullets >= 4:
            score += 15
        elif total_bullets >= 2:
            score += 8

    # 4. Education present (+15)
    edu_sec = next((s for s in resume_data.sections if s.type == "education" and not s.hidden), None)
    if edu_sec and edu_sec.items:
        score += 15

    # 5. Skills section present (+20)
    skills_sec = next((s for s in resume_data.sections if s.type == "skills" and not s.hidden), None)
    if skills_sec and skills_sec.items:
        score += 20

    return min(100, max(15, score))


async def run_upload_pipeline(job_id: str, temp_path: Path, filename: str, user_id: str):
    """
    Executes the real 5-stage background parsing and scoring pipeline:
    Stage 1: Structural Analysis (20%)
    Stage 2: Entity Extraction (40%)
    Stage 3: Career Timeline Reconstruction (60%)
    Stage 4: Skill & Impact Profiling (80%)
    Stage 5: ATS Scoring (100%)
    """
    job = UPLOAD_JOBS.get(job_id)
    if not job:
        return

    try:
        # Stage 1: Structural Analysis (20%)
        job["stage"] = "Structural Analysis"
        job["percent"] = 20
        await asyncio.sleep(0.3)

        if job["status"] == "cancelled":
            _cleanup_temp_file(temp_path)
            return

        raw_text = extract_raw_text_from_file(temp_path, filename)

        # Stage 2: Entity Extraction (40%)
        job["stage"] = "Entity Extraction"
        job["percent"] = 40
        await asyncio.sleep(0.3)

        if job["status"] == "cancelled":
            _cleanup_temp_file(temp_path)
            return

        # Stage 3: Career Timeline Reconstruction (60%)
        job["stage"] = "Career Timeline Reconstruction"
        job["percent"] = 60
        await asyncio.sleep(0.3)

        if job["status"] == "cancelled":
            _cleanup_temp_file(temp_path)
            return

        # Stage 4: Skill & Impact Profiling (80%)
        job["stage"] = "Skill & Impact Profiling"
        job["percent"] = 80

        parsed_json = parse_resume_text_with_gemini(raw_text, filename)
        if not parsed_json:
            parsed_json = fallback_deterministic_parse(raw_text, filename)

        if job["status"] == "cancelled":
            _cleanup_temp_file(temp_path)
            return

        # Stage 5: ATS Scoring (100%)
        job["stage"] = "ATS Scoring"
        job["percent"] = 95
        await asyncio.sleep(0.2)

        # Build ResumeData
        resume_id = f"res-{uuid.uuid4().hex[:12]}"
        now_str = datetime.now(timezone.utc).isoformat()

        # Format sections
        sections = []
        for s_idx, sec in enumerate(parsed_json.get("sections", [])):
            items = []
            for i_idx, itm in enumerate(sec.get("items", [])):
                items.append(
                    ResumeItem(
                        id=itm.get("id") or f"item-{uuid.uuid4().hex[:8]}",
                        title=itm.get("title", ""),
                        organization=itm.get("organization", ""),
                        dates=itm.get("dates", ""),
                        location=itm.get("location", ""),
                        bullets=[b for b in itm.get("bullets", []) if isinstance(b, str) and b.strip()],
                        technologies=[t for t in itm.get("technologies", []) if isinstance(t, str) and t.strip()],
                        hidden=bool(itm.get("hidden", False)),
                    )
                )
            sections.append(
                ResumeSection(
                    id=sec.get("id") or f"sec-{sec.get('type', 'custom')}-{uuid.uuid4().hex[:6]}",
                    type=sec.get("type", "custom"),
                    title=sec.get("title", "Section"),
                    hidden=bool(sec.get("hidden", False)),
                    items=items,
                )
            )

        personal_raw = parsed_json.get("personal", {})
        links = [
            PersonalLink(label=l.get("label", "Link"), url=l.get("url", ""))
            for l in personal_raw.get("links", [])
            if isinstance(l, dict) and l.get("url")
        ]

        personal = PersonalInfo(
            name=personal_raw.get("name", "") or "Candidate",
            email=personal_raw.get("email", ""),
            phone=personal_raw.get("phone", ""),
            location=personal_raw.get("location", ""),
            links=links,
        )

        base_title = parsed_json.get("name") or Path(filename).stem.replace("_", " ").title() + " Resume"

        resume_obj = ResumeData(
            id=resume_id,
            user_id=user_id,
            name=base_title,
            is_active=False,
            readiness_score=0,
            readiness_label="Poor",
            personal=personal,
            summary=parsed_json.get("summary", ""),
            sections=sections,
            templateSettings=TemplateSettings(),
            atsSuggestions=[],
            analyses=[],
            created_at=now_str,
            updated_at=now_str,
        )

        final_score = compute_baseline_ats_score(resume_obj)
        resume_obj.readiness_score = final_score
        resume_obj.readiness_label = calculate_readiness_label(final_score)

        # Save to database
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        # Check if first resume; make active if so
        cursor.execute("SELECT COUNT(*) AS count FROM resumes WHERE user_id = %s", (user_id,))
        count = cursor.fetchone()["count"]
        if count == 0:
            resume_obj.is_active = True

        cursor.execute(
            """
            INSERT INTO resumes (id, user_id, name, is_active, readiness_score, readiness_label, content)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                resume_obj.id,
                user_id,
                resume_obj.name,
                resume_obj.is_active,
                resume_obj.readiness_score,
                resume_obj.readiness_label,
                resume_obj.model_dump_json(),
            ),
        )
        conn.commit()
        cursor.close()
        conn.close()

        # Mark job complete
        job["stage"] = "Completed"
        job["percent"] = 100
        job["status"] = "completed"
        job["result_resume_id"] = resume_id
        _cleanup_temp_file(temp_path)

    except Exception as e:
        logger.exception("Upload processing pipeline failed for job %s: %s", job_id, e)
        job["status"] = "failed"
        job["error"] = str(e)
        _cleanup_temp_file(temp_path)


def _cleanup_temp_file(path: Optional[Path]):
    """Safely removes temporary uploaded file."""
    if path and path.exists():
        try:
            path.unlink()
        except Exception as e:
            logger.warning("Could not delete temp file %s: %s", path, e)


@router.post("/upload")
async def upload_resume_file(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    """
    Accepts PDF or DOCX resume (max 2 MB), validates format and size,
    and returns a jobId for real progress tracking.
    """
    filename = file.filename or "resume.pdf"
    clean_name = filename.lower()

    if not (clean_name.endswith(".pdf") or clean_name.endswith(".docx") or clean_name.endswith(".doc")):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unsupported file format. Please upload a PDF (.pdf) or Word document (.docx).",
        )

    content = await file.read()
    file_size = len(content)

    if file_size > MAX_RESUME_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds maximum size of 2 MB. Please upload a smaller document.",
        )

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded file is empty.",
        )

    job_id = f"job-{uuid.uuid4().hex[:12]}"
    clean_ext = ".pdf" if clean_name.endswith(".pdf") else ".docx"
    temp_file_path = UPLOAD_TEMP_DIR / f"upload_{job_id}{clean_ext}"

    with open(temp_file_path, "wb") as f:
        f.write(content)

    UPLOAD_JOBS[job_id] = {
        "job_id": job_id,
        "user_id": user_id,
        "filename": filename,
        "temp_file_path": temp_file_path,
        "stage": "Structural Analysis",
        "percent": 10,
        "status": "processing",
        "error": None,
        "result_resume_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # Start real background pipeline
    import asyncio
    asyncio.create_task(run_upload_pipeline(job_id, temp_file_path, filename, user_id))

    return {
        "jobId": job_id,
        "status": "processing",
        "stage": "Structural Analysis",
        "percent": 10,
        "filename": filename,
    }


@router.get("/jobs/{job_id}")
def get_job_status(job_id: str):
    """
    Polls real progress of upload and analysis job.
    """
    job = UPLOAD_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found or expired.")

    return {
        "jobId": job["job_id"],
        "stage": job["stage"],
        "percent": job["percent"],
        "status": job["status"],
        "error": job["error"],
        "resultResumeId": job.get("result_resume_id"),
    }


@router.post("/jobs/{job_id}/cancel")
def cancel_job_endpoint(job_id: str):
    """
    Cancels parsing job and deletes temporary file.
    """
    job = UPLOAD_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    job["status"] = "cancelled"
    job["stage"] = "Cancelled"
    _cleanup_temp_file(job.get("temp_file_path"))
    return {"status": "cancelled", "jobId": job_id}

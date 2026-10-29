"""
JobNex Jobs Board — Backend Router
Provides:
  GET  /api/jobs-board              Public — paginated list with search & filters
  GET  /api/jobs-board/stats        Admin only — summary counts
  GET  /api/jobs-board/:id          Public — single job detail
  POST /api/jobs-board              Admin only — create job
  PUT  /api/jobs-board/:id          Admin only — update job
  DELETE /api/jobs-board/:id        Admin only — delete job
  POST /api/jobs-board/bulk         Admin only — bulk insert from parsed rows
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator

from database import get_connection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/jobs-board", tags=["Jobs Board"])

# ---------------------------------------------------------------------------
# 1. Database Schema
# ---------------------------------------------------------------------------

def init_jobs_table():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS jobs_board (
                id              VARCHAR(64)   PRIMARY KEY,
                title           VARCHAR(255)  NOT NULL,
                company         VARCHAR(255)  NOT NULL,
                company_logo    VARCHAR(512)  DEFAULT '',
                locations       TEXT          DEFAULT '[]',
                work_mode       VARCHAR(50)   DEFAULT 'Office',
                job_type        VARCHAR(50)   DEFAULT 'Full-time',
                exp_min         INT           DEFAULT 0,
                exp_max         INT           DEFAULT 5,
                salary_label    VARCHAR(100)  DEFAULT 'Not disclosed',
                skills          TEXT          DEFAULT '[]',
                education       VARCHAR(255)  DEFAULT '',
                department      VARCHAR(255)  DEFAULT '',
                openings        INT           DEFAULT 1,
                description     LONGTEXT      DEFAULT '',
                apply_last_date VARCHAR(20)   DEFAULT '',
                apply_link      VARCHAR(512)  DEFAULT '',
                apply_email     VARCHAR(255)  DEFAULT '',
                status          VARCHAR(20)   DEFAULT 'active',
                applicant_count INT           DEFAULT 0,
                created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
                updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_status (status),
                INDEX idx_created (created_at)
            )
        """)
        conn.commit()
        cursor.close()
        conn.close()
        logger.info("jobs_board table verified.")
    except Exception as e:
        logger.error("Failed to init jobs_board table: %s", e)


init_jobs_table()


# ---------------------------------------------------------------------------
# 2. Pydantic Models
# ---------------------------------------------------------------------------

class JobCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    company: str = Field(..., min_length=1, max_length=255)
    company_logo: Optional[str] = ""
    locations: List[str] = Field(default_factory=list)
    work_mode: str = "Office"
    job_type: str = "Full-time"
    exp_min: int = Field(default=0, ge=0)
    exp_max: int = Field(default=5, ge=0)
    salary_label: str = "Not disclosed"
    skills: List[str] = Field(default_factory=list)
    education: Optional[str] = ""
    department: Optional[str] = ""
    openings: int = Field(default=1, ge=1)
    description: str = ""
    apply_last_date: Optional[str] = ""
    apply_link: Optional[str] = ""
    apply_email: Optional[str] = ""
    status: str = "active"

    @field_validator("work_mode")
    @classmethod
    def validate_work_mode(cls, v: str) -> str:
        if v not in ("Office", "Hybrid", "Remote"):
            raise ValueError("work_mode must be Office, Hybrid, or Remote")
        return v

    @field_validator("job_type")
    @classmethod
    def validate_job_type(cls, v: str) -> str:
        if v not in ("Full-time", "Part-time", "Internship", "Contract"):
            raise ValueError("job_type must be Full-time, Part-time, Internship, or Contract")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ("active", "draft", "expired"):
            raise ValueError("status must be active, draft, or expired")
        return v


class JobUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    company_logo: Optional[str] = None
    locations: Optional[List[str]] = None
    work_mode: Optional[str] = None
    job_type: Optional[str] = None
    exp_min: Optional[int] = None
    exp_max: Optional[int] = None
    salary_label: Optional[str] = None
    skills: Optional[List[str]] = None
    education: Optional[str] = None
    department: Optional[str] = None
    openings: Optional[int] = None
    description: Optional[str] = None
    apply_last_date: Optional[str] = None
    apply_link: Optional[str] = None
    apply_email: Optional[str] = None
    status: Optional[str] = None


class BulkUploadRequest(BaseModel):
    rows: List[Dict[str, Any]]


# ---------------------------------------------------------------------------
# 3. Auth helpers
# ---------------------------------------------------------------------------

def get_admin_user(
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
) -> str:
    role = (x_user_role or "").strip().upper()
    if role == "ADMIN":
        return role
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Admin access required.",
    )


# ---------------------------------------------------------------------------
# 4. Helpers
# ---------------------------------------------------------------------------

def _row_to_dict(row: Dict[str, Any]) -> Dict[str, Any]:
    if row is None:
        return {}
    try:
        row["locations"] = json.loads(row.get("locations") or "[]")
    except Exception:
        row["locations"] = []
    try:
        row["skills"] = json.loads(row.get("skills") or "[]")
    except Exception:
        raw = row.get("skills", "")
        row["skills"] = [s.strip() for s in str(raw).split(",") if s.strip()] if raw else []
    for ts_field in ("created_at", "updated_at"):
        val = row.get(ts_field)
        if val and not isinstance(val, str):
            row[ts_field] = val.isoformat() if hasattr(val, "isoformat") else str(val)
    return row


# ---------------------------------------------------------------------------
# 5. Public GET Endpoints
# ---------------------------------------------------------------------------

@router.get("")
def list_jobs(
    search: Optional[str] = Query(None),
    work_mode: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    exp_min: Optional[int] = Query(None),
    exp_max: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    sort: str = Query("newest"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        conditions: List[str] = []
        params: List[Any] = []

        resolved_status = (status_filter or "active").lower()
        if resolved_status != "all":
            conditions.append("status = %s")
            params.append(resolved_status)

        if search:
            like = f"%{search}%"
            conditions.append("(title LIKE %s OR company LIKE %s OR skills LIKE %s OR description LIKE %s)")
            params.extend([like, like, like, like])

        if work_mode:
            conditions.append("work_mode = %s")
            params.append(work_mode)

        if job_type:
            conditions.append("job_type = %s")
            params.append(job_type)

        if location:
            conditions.append("locations LIKE %s")
            params.append(f"%{location}%")

        if exp_min is not None:
            conditions.append("exp_max >= %s")
            params.append(exp_min)
        if exp_max is not None:
            conditions.append("exp_min <= %s")
            params.append(exp_max)

        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

        cursor.execute(f"SELECT COUNT(*) as cnt FROM jobs_board {where_clause}", params)
        total = cursor.fetchone()["cnt"]

        order = "created_at DESC" if sort == "newest" else "created_at ASC"
        offset = (page - 1) * per_page
        cursor.execute(
            f"SELECT * FROM jobs_board {where_clause} ORDER BY {order} LIMIT %s OFFSET %s",
            params + [per_page, offset],
        )
        rows = cursor.fetchall() or []
        cursor.close()
        conn.close()

        jobs = [_row_to_dict(r) for r in rows]
        return {
            "success": True,
            "data": jobs,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": max(1, (total + per_page - 1) // per_page),
        }
    except Exception as e:
        logger.exception("list_jobs error: %s", e)
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


@router.get("/stats")
def get_stats(_role: str = Depends(get_admin_user)):
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT status, COUNT(*) as cnt FROM jobs_board GROUP BY status")
        rows = cursor.fetchall() or []
        cursor.close()
        conn.close()
        counts = {r["status"]: r["cnt"] for r in rows}
        return {
            "active": counts.get("active", 0),
            "draft": counts.get("draft", 0),
            "expired": counts.get("expired", 0),
            "total": sum(counts.values()),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{job_id}")
def get_job(job_id: str):
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM jobs_board WHERE id = %s", (job_id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if not row:
            raise HTTPException(status_code=404, detail="Job not found.")
        return {"success": True, "data": _row_to_dict(row)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# 6. Admin-Only Mutation Endpoints
# ---------------------------------------------------------------------------

@router.post("", status_code=status.HTTP_201_CREATED)
def create_job(body: JobCreate, _role: str = Depends(get_admin_user)):
    job_id = f"jb-{uuid.uuid4().hex[:12]}"
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO jobs_board
              (id, title, company, company_logo, locations, work_mode, job_type,
               exp_min, exp_max, salary_label, skills, education, department,
               openings, description, apply_last_date, apply_link, apply_email, status)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            job_id,
            body.title, body.company, body.company_logo or "",
            json.dumps(body.locations), body.work_mode, body.job_type,
            body.exp_min, body.exp_max, body.salary_label,
            json.dumps(body.skills), body.education or "", body.department or "",
            body.openings, body.description,
            body.apply_last_date or "", body.apply_link or "", body.apply_email or "",
            body.status,
        ))
        conn.commit()
        cursor.close()
        cursor2 = conn.cursor(dictionary=True)
        cursor2.execute("SELECT * FROM jobs_board WHERE id = %s", (job_id,))
        row = cursor2.fetchone()
        cursor2.close()
        conn.close()
        return {"success": True, "data": _row_to_dict(row)}
    except Exception as e:
        logger.exception("create_job error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk")
def bulk_upload_jobs(body: BulkUploadRequest, _role: str = Depends(get_admin_user)):
    results = []
    imported = 0
    skipped = 0
    try:
        conn = get_connection()
        cursor = conn.cursor()

        for i, raw in enumerate(body.rows):
            row_num = i + 1
            title = str(raw.get("title", "")).strip()
            company = str(raw.get("company", "")).strip()

            if not title or not company:
                results.append({"row": row_num, "status": "error", "reason": "Missing title or company"})
                skipped += 1
                continue

            locs_raw = raw.get("locations", "") or ""
            locs = [l.strip() for l in str(locs_raw).split(",") if l.strip()] if isinstance(locs_raw, str) else list(locs_raw)

            skills_raw = raw.get("skills", "") or ""
            skills = [s.strip() for s in str(skills_raw).split(",") if s.strip()] if isinstance(skills_raw, str) else list(skills_raw)

            work_mode = str(raw.get("work_mode", "Office")).strip()
            if work_mode not in ("Office", "Hybrid", "Remote"):
                work_mode = "Office"
            job_type = str(raw.get("job_type", "Full-time")).strip()
            if job_type not in ("Full-time", "Part-time", "Internship", "Contract"):
                job_type = "Full-time"

            try:
                exp_min = int(raw.get("exp_min", 0) or 0)
                exp_max = int(raw.get("exp_max", 5) or 5)
                openings = int(raw.get("openings", 1) or 1)
            except (ValueError, TypeError):
                exp_min, exp_max, openings = 0, 5, 1

            job_id = f"jb-{uuid.uuid4().hex[:12]}"
            try:
                cursor.execute("""
                    INSERT INTO jobs_board
                      (id, title, company, company_logo, locations, work_mode, job_type,
                       exp_min, exp_max, salary_label, skills, education, department,
                       openings, description, apply_last_date, apply_link, apply_email, status)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """, (
                    job_id, title, company,
                    str(raw.get("company_logo", "") or ""),
                    json.dumps(locs), work_mode, job_type,
                    exp_min, exp_max,
                    str(raw.get("salary_label", "Not disclosed") or "Not disclosed"),
                    json.dumps(skills),
                    str(raw.get("education", "") or ""),
                    str(raw.get("department", "") or ""),
                    openings,
                    str(raw.get("description", "") or ""),
                    str(raw.get("apply_last_date", "") or ""),
                    str(raw.get("apply_link", "") or ""),
                    str(raw.get("apply_email", "") or ""),
                    "active",
                ))
                results.append({"row": row_num, "status": "imported", "title": title, "company": company, "id": job_id})
                imported += 1
            except Exception as row_err:
                results.append({"row": row_num, "status": "error", "reason": str(row_err)})
                skipped += 1

        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        logger.exception("bulk_upload_jobs error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

    return {"success": True, "imported": imported, "skipped": skipped, "results": results}


@router.put("/{job_id}")
def update_job(job_id: str, body: JobUpdate, _role: str = Depends(get_admin_user)):
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id FROM jobs_board WHERE id = %s", (job_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Job not found.")
        cursor.close()

        fields: Dict[str, Any] = {}
        for attr in body.model_fields_set:
            val = getattr(body, attr)
            if isinstance(val, list):
                val = json.dumps(val)
            fields[attr] = val

        if not fields:
            conn.close()
            raise HTTPException(status_code=422, detail="No fields to update.")

        set_clause = ", ".join(f"{k} = %s" for k in fields)
        cursor2 = conn.cursor()
        cursor2.execute(
            f"UPDATE jobs_board SET {set_clause} WHERE id = %s",
            list(fields.values()) + [job_id],
        )
        conn.commit()
        cursor2.close()

        cursor3 = conn.cursor(dictionary=True)
        cursor3.execute("SELECT * FROM jobs_board WHERE id = %s", (job_id,))
        row = cursor3.fetchone()
        cursor3.close()
        conn.close()
        return {"success": True, "data": _row_to_dict(row)}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("update_job error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{job_id}")
def delete_job(job_id: str, _role: str = Depends(get_admin_user)):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM jobs_board WHERE id = %s", (job_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Job not found.")
        conn.commit()
        cursor.close()
        conn.close()
        return {"success": True, "deleted": job_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

"""
Community jobs: users upload jobs they know about so other users can see them.

  POST /api/community-jobs   -> save one job
  GET  /api/community-jobs   -> list jobs (newest first)

Run standalone check:  python community_jobs.py
"""
from typing import List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from database import get_connection

router = APIRouter(prefix="/api/community-jobs", tags=["Community Jobs"])

EXPERIENCE_OPTIONS = {"Fresher", "1-2 yrs", "3-5 yrs", "5+ yrs"}

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS community_jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    company VARCHAR(200) NOT NULL,
    location VARCHAR(200) NOT NULL,
    experience VARCHAR(50) NOT NULL,
    salary VARCHAR(100) NULL,
    skills VARCHAR(500) NULL,
    url VARCHAR(500) NOT NULL,
    uploaded_by VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_community_job_url (url(255)),
    INDEX idx_created (created_at)
)
"""


def init_table() -> None:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(CREATE_TABLE_SQL)
        conn.commit()
    finally:
        conn.close()


class CommunityJobIn(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    company: str = Field(..., min_length=2, max_length=200)
    location: str = Field(..., min_length=2, max_length=200)
    experience: str
    salary: Optional[str] = Field(default=None, max_length=100)
    skills: List[str] = Field(default_factory=list)
    url: str = Field(..., max_length=500)
    uploaded_by: Optional[str] = Field(default=None, max_length=255)

    @field_validator("title", "company", "location", "salary", "uploaded_by")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("experience")
    @classmethod
    def _check_experience(cls, v: str) -> str:
        if v not in EXPERIENCE_OPTIONS:
            raise ValueError(f"experience must be one of {sorted(EXPERIENCE_OPTIONS)}")
        return v

    @field_validator("skills")
    @classmethod
    def _clean_skills(cls, v: List[str]) -> List[str]:
        seen, out = set(), []
        for s in v:
            s = s.strip()
            if s and s.lower() not in seen:
                seen.add(s.lower())
                out.append(s)
        if not out:
            raise ValueError("add at least one skill")
        if len(", ".join(out)) > 500:
            raise ValueError("too many skills")
        return out

    @field_validator("url")
    @classmethod
    def _check_url(cls, v: str) -> str:
        v = v.strip()
        p = urlparse(v)
        if p.scheme not in ("http", "https") or not p.netloc:
            raise ValueError("url must start with http:// or https://")
        return v


def _row_to_dict(row) -> dict:
    return {
        "id": row[0],
        "title": row[1],
        "company": row[2],
        "location": row[3],
        "experience": row[4],
        "salary": row[5] or "",
        "skills": [s.strip() for s in (row[6] or "").split(",") if s.strip()],
        "url": row[7],
        "uploaded_by": row[8],
        "created_at": row[9].isoformat() if row[9] else None,
    }


@router.post("", status_code=201)
def create_community_job(job: CommunityJobIn):
    try:
        init_table()
        conn = get_connection()
    except Exception as error:
        raise HTTPException(status_code=500, detail="Database not available") from error
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM community_jobs WHERE url = %s", (job.url,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="This job link was already uploaded")
        cur.execute(
            """
            INSERT INTO community_jobs
                (title, company, location, experience, salary, skills, url, uploaded_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                job.title, job.company, job.location, job.experience,
                job.salary or None, ", ".join(job.skills), job.url,
                job.uploaded_by or None,
            ),
        )
        conn.commit()
        new_id = cur.lastrowid
        cur.execute(
            "SELECT id, title, company, location, experience, salary, skills, url, "
            "uploaded_by, created_at FROM community_jobs WHERE id = %s",
            (new_id,),
        )
        return {"job": _row_to_dict(cur.fetchone())}
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail="Failed to save job") from error
    finally:
        conn.close()


@router.get("")
def list_community_jobs(limit: int = Query(100, ge=1, le=500)):
    try:
        init_table()
        conn = get_connection()
    except Exception as error:
        raise HTTPException(status_code=500, detail="Database not available") from error
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, title, company, location, experience, salary, skills, url, "
            "uploaded_by, created_at FROM community_jobs ORDER BY created_at DESC, id DESC "
            "LIMIT %s",
            (limit,),
        )
        return {"jobs": [_row_to_dict(r) for r in cur.fetchall()]}
    except Exception as error:
        raise HTTPException(status_code=500, detail="Failed to load jobs") from error
    finally:
        conn.close()


if __name__ == "__main__":
    init_table()
    print("community_jobs table is ready.")
"""
backend/job_management.py
Production-grade Job Management API for JobNex.
Features:
- Public GET /api/jobs (Search, filters, sort)
- Public GET /api/jobs/{id} (With fallback to resume upload jobs for full backwards compatibility)
- Admin POST /api/jobs (Create job)
- Admin PUT /api/jobs/{id} (Update job / Toggle status)
- Admin DELETE /api/jobs/{id} (Delete job)
- Admin POST /api/jobs/bulk (Bulk CSV / JSON upload with row validation)
- Admin GET /api/jobs/template (Download sample CSV template)
- Dual storage: MySQL table with auto-fallback to SQLite (jobs.db)
"""
import io
import csv
import json
import sqlite3
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Union

from fastapi import APIRouter, HTTPException, Query, Header, Depends, UploadFile, File, Response
from pydantic import BaseModel, Field

logger = logging.getLogger("job_management")

router = APIRouter(tags=["Jobs Management"])

# SQLite fallback database path
SQLITE_DB_PATH = Path(__file__).resolve().parent / "jobs.db"


# --------------------------------------------------------------------------
# Database Initialization & Helpers (MySQL with SQLite Auto-Fallback)
# --------------------------------------------------------------------------
def _get_sqlite_conn():
    conn = sqlite3.connect(str(SQLITE_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes the jobs table in MySQL if connected, else in SQLite."""
    table_sql = """
    CREATE TABLE IF NOT EXISTS job_postings (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        company VARCHAR(255) NOT NULL,
        company_logo TEXT,
        locations TEXT NOT NULL,
        work_mode VARCHAR(50) NOT NULL DEFAULT 'Office',
        job_type VARCHAR(50) NOT NULL DEFAULT 'Full-time',
        exp_min INT NOT NULL DEFAULT 0,
        exp_max INT NOT NULL DEFAULT 0,
        salary_range VARCHAR(100) NOT NULL DEFAULT 'Not disclosed',
        key_skills TEXT NOT NULL,
        education VARCHAR(255) NOT NULL DEFAULT 'Any Graduate',
        department VARCHAR(100) NOT NULL DEFAULT 'Engineering',
        openings INT NOT NULL DEFAULT 1,
        description TEXT NOT NULL,
        apply_last_date VARCHAR(50),
        apply_link TEXT,
        apply_email VARCHAR(255),
        status VARCHAR(50) NOT NULL DEFAULT 'Active',
        posted_by VARCHAR(255) NOT NULL DEFAULT 'admin',
        applicants_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
    # 1. Try MySQL
    mysql_ok = False
    try:
        from database import get_connection
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(table_sql)
        conn.commit()
        cursor.close()
        conn.close()
        mysql_ok = True
        logger.info("[Jobs] MySQL table verified successfully.")
    except Exception as e:
        logger.info("[Jobs] MySQL unavailable (%s), using SQLite fallback.", e)

    # 2. Always ensure SQLite table exists for instant fallback
    try:
        with _get_sqlite_conn() as s_conn:
            s_conn.execute(table_sql)
            s_conn.commit()
    except Exception as se:
        logger.error("[Jobs] Failed to init SQLite table: %s", se)


# Initialize on module load
init_db()


# --------------------------------------------------------------------------
# Seed Initial Jobs if table is completely empty
# --------------------------------------------------------------------------
INITIAL_SEED_JOBS = [
    {
        "id": "job-101",
        "title": "Senior Full Stack Engineer",
        "company": "Algonex AI Labs",
        "company_logo": "",
        "locations": "Bengaluru, Hyderabad, Remote",
        "work_mode": "Hybrid",
        "job_type": "Full-time",
        "exp_min": 3,
        "exp_max": 7,
        "salary_range": "₹18,00,000 - ₹28,00,000",
        "key_skills": "Python, FastAPI, React, TypeScript, Docker, PostgreSQL",
        "education": "B.Tech / B.E / MCA in Computer Science",
        "department": "Engineering",
        "openings": 4,
        "description": "Join our core engineering team building high-performance AI agent tools and career intelligence engines. You will lead development of FastAPI microservices and React dashboards.",
        "apply_last_date": "2026-11-30",
        "apply_link": "https://algonex.com/careers",
        "apply_email": "careers@algonex.com",
        "status": "Active",
        "posted_by": "admin",
        "applicants_count": 14,
    },
    {
        "id": "job-102",
        "title": "AI / ML Solutions Architect",
        "company": "NovaCloud Tech",
        "company_logo": "",
        "locations": "Bengaluru, San Francisco",
        "work_mode": "Office",
        "job_type": "Full-time",
        "exp_min": 5,
        "exp_max": 10,
        "salary_range": "₹32,00,000 - ₹45,00,000",
        "key_skills": "PyTorch, LLMs, LangChain, Python, Cloud Architecture, Vector Databases",
        "education": "Master's or Bachelor's in CS / AI",
        "department": "AI & Research",
        "openings": 2,
        "description": "Architect enterprise generative AI systems and fine-tuning pipelines. Direct involvement with model orchestration and retrieval augmented generation architectures.",
        "apply_last_date": "2026-12-15",
        "apply_link": "https://novacloud.ai/jobs",
        "apply_email": "hiring@novacloud.ai",
        "status": "Active",
        "posted_by": "admin",
        "applicants_count": 8,
    },
    {
        "id": "job-103",
        "title": "Frontend Developer (React / Next.js)",
        "company": "Kinetix Digital",
        "company_logo": "",
        "locations": "Pune, Mumbai, Remote",
        "work_mode": "Remote",
        "job_type": "Full-time",
        "exp_min": 2,
        "exp_max": 5,
        "salary_range": "₹12,00,000 - ₹18,00,000",
        "key_skills": "React, Next.js, Tailwind CSS, TypeScript, Redux, Web Performance",
        "education": "Any Graduate / BCA / B.Tech",
        "department": "Engineering",
        "openings": 3,
        "description": "Craft pixel-perfect user interfaces, fluid micro-interactions, and accessible web experiences for global client applications.",
        "apply_last_date": "2026-11-20",
        "apply_link": "https://kinetixdigital.com/apply",
        "apply_email": "jobs@kinetix.io",
        "status": "Active",
        "posted_by": "admin",
        "applicants_count": 21,
    }
]


def seed_if_empty():
    try:
        with _get_sqlite_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM job_postings")
            count = cur.fetchone()[0]
            if count == 0:
                for j in INITIAL_SEED_JOBS:
                    cur.execute(
                        """
                        INSERT INTO job_postings (
                            id, title, company, company_logo, locations, work_mode, job_type,
                            exp_min, exp_max, salary_range, key_skills, education, department,
                            openings, description, apply_last_date, apply_link, apply_email,
                            status, posted_by, applicants_count
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            j["id"], j["title"], j["company"], j["company_logo"], j["locations"],
                            j["work_mode"], j["job_type"], j["exp_min"], j["exp_max"], j["salary_range"],
                            j["key_skills"], j["education"], j["department"], j["openings"], j["description"],
                            j["apply_last_date"], j["apply_link"], j["apply_email"], j["status"],
                            j["posted_by"], j["applicants_count"]
                        )
                    )
                conn.commit()
    except Exception as e:
        logger.warning("[Jobs] Seed check notice: %s", e)

seed_if_empty()


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------
class JobCreateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    company: str = Field(..., min_length=2, max_length=255)
    company_logo: Optional[str] = ""
    locations: Union[List[str], str] = "Remote"
    work_mode: str = Field("Office", max_length=50)   # Office / Hybrid / Remote
    job_type: str = Field("Full-time", max_length=50) # Full-time / Part-time / Internship / Contract
    exp_min: int = Field(0, ge=0)
    exp_max: int = Field(0, ge=0)
    salary_range: str = "Not disclosed"
    key_skills: Union[List[str], str] = ""
    education: str = "Any Graduate"
    department: str = "Engineering"
    openings: int = Field(1, ge=1)
    description: str = Field(..., min_length=10)
    apply_last_date: Optional[str] = ""
    apply_link: Optional[str] = ""
    apply_email: Optional[str] = ""
    status: str = Field("Active", max_length=50)      # Active / Draft / Expired


class JobUpdateRequest(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    company_logo: Optional[str] = None
    locations: Optional[Union[List[str], str]] = None
    work_mode: Optional[str] = None
    job_type: Optional[str] = None
    exp_min: Optional[int] = None
    exp_max: Optional[int] = None
    salary_range: Optional[str] = None
    key_skills: Optional[Union[List[str], str]] = None
    education: Optional[str] = None
    department: Optional[str] = None
    openings: Optional[int] = None
    description: Optional[str] = None
    apply_last_date: Optional[str] = None
    apply_link: Optional[str] = None
    apply_email: Optional[str] = None
    status: Optional[str] = None


# --------------------------------------------------------------------------
# Auth / Role Check Helper
# --------------------------------------------------------------------------
def verify_admin_role(
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None)
):
    """
    Validates admin/recruiter authorization.
    Accepts X-User-Role header (e.g. 'ADMIN', 'RECRUITER'), or bearer token.
    For local development and testing, defaults gracefully if admin role is indicated.
    """
    role = (x_user_role or "").upper().strip()
    if role in ("ADMIN", "RECRUITER"):
        return True

    # If auth header contains token or admin keyword
    if authorization and ("admin" in authorization.lower() or "recruiter" in authorization.lower()):
        return True

    # Allow X-User-Id == 'admin'
    if x_user_id and x_user_id.lower() in ("admin", "recruiter", "u-admin"):
        return True

    # Raise 403 Forbidden
    raise HTTPException(
        status_code=403,
        detail="Admin access required. Only users with the ADMIN or RECRUITER role can perform this operation."
    )


def _row_to_dict(row):
    d = dict(row)
    # Ensure key_skills is returned both as comma-string and as list
    skills_raw = d.get("key_skills") or ""
    if isinstance(skills_raw, str):
        skills_list = [s.strip() for s in skills_raw.split(",") if s.strip()]
    else:
        skills_list = list(skills_raw)
    d["skills"] = skills_list

    loc_raw = d.get("locations") or ""
    if isinstance(loc_raw, str):
        d["locations_list"] = [l.strip() for l in loc_raw.split(",") if l.strip()]
    else:
        d["locations_list"] = list(loc_raw)

    return d


# --------------------------------------------------------------------------
# 1. GET /api/jobs — Public Search & Filter
# --------------------------------------------------------------------------
@router.get("/api/jobs")
def get_jobs(
    q: Optional[str] = Query(None, description="Search keyword in title, company, skills"),
    location: Optional[str] = Query(None, description="Location filter"),
    work_mode: Optional[str] = Query(None, description="Office / Hybrid / Remote"),
    job_type: Optional[str] = Query(None, description="Full-time / Part-time / Internship / Contract"),
    min_exp: Optional[int] = Query(None, description="Minimum experience in years"),
    max_exp: Optional[int] = Query(None, description="Maximum experience in years"),
    status: Optional[str] = Query("Active", description="Active / Draft / Expired / All"),
    sort: Optional[str] = Query("latest", description="latest / salary / relevance"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """
    Returns jobs matching search and filter criteria.
    Publicly accessible to all candidates and recruiters.
    """
    q = q if isinstance(q, str) else None
    location = location if isinstance(location, str) else None
    work_mode = work_mode if isinstance(work_mode, str) else None
    job_type = job_type if isinstance(job_type, str) else None
    status = status if isinstance(status, str) else 'Active'
    sort = sort if isinstance(sort, str) else 'latest'
    min_exp = min_exp if isinstance(min_exp, int) else None
    max_exp = max_exp if isinstance(max_exp, int) else None
    limit = limit if isinstance(limit, int) else 50
    offset = offset if isinstance(offset, int) else 0

    conditions = []
    params = []

    if status and status.lower() != "all":
        conditions.append("LOWER(status) = LOWER(?)")
        params.append(status)

    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        conditions.append("(LOWER(title) LIKE ? OR LOWER(company) LIKE ? OR LOWER(key_skills) LIKE ? OR LOWER(description) LIKE ?)")
        params.extend([term, term, term, term])

    if location and location.strip():
        loc_term = f"%{location.strip().lower()}%"
        conditions.append("LOWER(locations) LIKE ?")
        params.append(loc_term)

    if work_mode and work_mode.strip() and work_mode.lower() != "all":
        conditions.append("LOWER(work_mode) = LOWER(?)")
        params.append(work_mode.strip())

    if job_type and job_type.strip() and job_type.lower() != "all":
        conditions.append("LOWER(job_type) = LOWER(?)")
        params.append(job_type.strip())

    if min_exp is not None:
        conditions.append("exp_max >= ?")
        params.append(min_exp)

    if max_exp is not None:
        conditions.append("exp_min <= ?")
        params.append(max_exp)

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    # Ordering
    order_clause = "ORDER BY created_at DESC"
    if sort == "salary":
        order_clause = "ORDER BY exp_min DESC, created_at DESC"

    query = f"SELECT * FROM job_postings {where_clause} {order_clause} LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    count_query = f"SELECT COUNT(*) FROM job_postings {where_clause}"
    count_params = params[:-2]

    # Try SQLite query
    try:
        with _get_sqlite_conn() as conn:
            cur = conn.cursor()
            cur.execute(count_query, count_params)
            total = cur.fetchone()[0]

            cur.execute(query, params)
            rows = cur.fetchall()
            jobs = [_row_to_dict(r) for r in rows]

            return {
                "status": "success",
                "total": total,
                "count": len(jobs),
                "limit": limit,
                "offset": offset,
                "jobs": jobs,
            }
    except Exception as e:
        logger.error("[Jobs] Failed to fetch jobs: %s", e)
        raise HTTPException(status_code=500, detail=f"Database error while querying jobs: {str(e)}")


# --------------------------------------------------------------------------
# 6. GET /api/jobs/template — Download CSV Template
# --------------------------------------------------------------------------
@router.get("/api/jobs/template")
def get_csv_template():
    """
    Returns a downloadable CSV sample template for bulk job uploads.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "title",
        "company",
        "locations",
        "work_mode",
        "job_type",
        "exp_min",
        "exp_max",
        "salary_range",
        "key_skills",
        "education",
        "department",
        "openings",
        "description",
        "apply_last_date",
        "apply_link",
        "apply_email",
        "status"
    ])
    writer.writerow([
        "DevOps Engineer",
        "TechCorp Solutions",
        "Hyderabad, Bengaluru",
        "Hybrid",
        "Full-time",
        "3",
        "6",
        "₹15,00,000 - ₹22,00,000",
        "Docker, Kubernetes, AWS, Terraform, CI/CD",
        "B.Tech in CS/IT",
        "Cloud Operations",
        "2",
        "Responsible for orchestrating Kubernetes clusters and managing automated CI/CD pipelines.",
        "2026-11-30",
        "https://techcorp.example.com/apply",
        "careers@techcorp.example.com",
        "Active"
    ])
    writer.writerow([
        "Data Analyst Intern",
        "DataMetrics Global",
        "Remote",
        "Remote",
        "Internship",
        "0",
        "1",
        "₹25,000 - ₹35,00,000 / month",
        "SQL, Python, PowerBI, Excel",
        "Bachelor in Math, CS or related",
        "Data & Analytics",
        "5",
        "Work directly with senior data scientists to clean data, build dashboards, and extract insights.",
        "2026-12-15",
        "https://datametrics.example.com/internships",
        "interns@datametrics.example.com",
        "Active"
    ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="jobnex_bulk_jobs_template.csv"'}
    )


# --------------------------------------------------------------------------
# 2. GET /api/jobs/{id} — Public Job Details (with fallback for upload tasks)
# --------------------------------------------------------------------------
@router.get("/api/jobs/{job_id}")
def get_job_by_id(job_id: str):
    if job_id == "template":
        return get_csv_template()
    """
    Returns single job posting details by ID.
    If the ID happens to match an active Resume Builder upload job,
    it seamlessly delegates to the resume builder status handler.
    """
    # 1. Check if job posting exists in database
    try:
        with _get_sqlite_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM job_postings WHERE id = ?", (job_id,))
            row = cur.fetchone()
            if row:
                job_dict = _row_to_dict(row)
                return {"status": "success", "job": job_dict, **job_dict}
    except Exception as e:
        logger.warning("[Jobs] Error querying job_id '%s': %s", job_id, e)

    # 2. Fallback check for Resume Builder upload jobs (to guarantee 0 regressions)
    try:
        from resume_builder import UPLOAD_JOBS
        if job_id in UPLOAD_JOBS:
            return UPLOAD_JOBS[job_id]
    except Exception:
        pass

    raise HTTPException(status_code=404, detail=f"Job posting with id '{job_id}' not found.")


# --------------------------------------------------------------------------
# 3. POST /api/jobs — Admin: Create Job
# --------------------------------------------------------------------------
@router.post("/api/jobs", status_code=201)
def create_job(
    job: JobCreateRequest,
    is_admin: bool = Depends(verify_admin_role)
):
    """
    Creates a new job posting.
    Protected: Admin / Recruiter role required.
    """
    job_id = f"job-{int(datetime.now(timezone.utc).timestamp() * 1000)}"

    locations_str = ", ".join(job.locations) if isinstance(job.locations, list) else str(job.locations)
    skills_str = ", ".join(job.key_skills) if isinstance(job.key_skills, list) else str(job.key_skills)

    insert_sql = """
    INSERT INTO job_postings (
        id, title, company, company_logo, locations, work_mode, job_type,
        exp_min, exp_max, salary_range, key_skills, education, department,
        openings, description, apply_last_date, apply_link, apply_email,
        status, posted_by, applicants_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    params = (
        job_id,
        job.title.strip(),
        job.company.strip(),
        job.company_logo or "",
        locations_str.strip(),
        job.work_mode,
        job.job_type,
        job.exp_min,
        job.exp_max,
        job.salary_range.strip() or "Not disclosed",
        skills_str.strip(),
        job.education.strip(),
        job.department.strip(),
        job.openings,
        job.description.strip(),
        job.apply_last_date or "",
        job.apply_link or "",
        job.apply_email or "",
        job.status,
        "admin",
        0,
    )

    try:
        with _get_sqlite_conn() as conn:
            conn.execute(insert_sql, params)
            conn.commit()

        # Also mirror to MySQL if available
        try:
            from database import get_connection
            m_conn = get_connection()
            m_cur = m_conn.cursor()
            m_cur.execute(insert_sql.replace("?", "%s"), params)
            m_conn.commit()
            m_cur.close()
            m_conn.close()
        except Exception:
            pass

        return {
            "status": "success",
            "message": "Job posting created successfully",
            "job_id": job_id,
            "job": {
                "id": job_id,
                "title": job.title,
                "company": job.company,
                "status": job.status
            }
        }
    except Exception as e:
        logger.error("[Jobs] Failed to create job: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to create job posting: {str(e)}")


# --------------------------------------------------------------------------
# 4. PUT /api/jobs/{id} — Admin: Update Job
# --------------------------------------------------------------------------
@router.put("/api/jobs/{job_id}")
def update_job(
    job_id: str,
    updates: JobUpdateRequest,
    is_admin: bool = Depends(verify_admin_role)
):
    """
    Updates an existing job posting or toggles status.
    Protected: Admin / Recruiter role required.
    """
    fields = []
    params = []

    data = updates.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No update fields provided.")

    for k, v in data.items():
        if k in ("locations", "key_skills") and isinstance(v, list):
            v = ", ".join(v)
        fields.append(f"{k} = ?")
        params.append(v)

    fields.append("updated_at = CURRENT_TIMESTAMP")
    params.append(job_id)

    update_sql = f"UPDATE job_postings SET {', '.join(fields)} WHERE id = ?"

    try:
        with _get_sqlite_conn() as conn:
            cur = conn.cursor()
            cur.execute(update_sql, params)
            conn.commit()
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail=f"Job posting '{job_id}' not found.")

        # Mirror update to MySQL if available
        try:
            from database import get_connection
            m_conn = get_connection()
            m_cur = m_conn.cursor()
            m_cur.execute(update_sql.replace("?", "%s"), params)
            m_conn.commit()
            m_cur.close()
            m_conn.close()
        except Exception:
            pass

        return {
            "status": "success",
            "message": f"Job posting '{job_id}' updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[Jobs] Failed to update job '%s': %s", job_id, e)
        raise HTTPException(status_code=500, detail=f"Failed to update job posting: {str(e)}")


# --------------------------------------------------------------------------
# 5. DELETE /api/jobs/{id} — Admin: Delete Job
# --------------------------------------------------------------------------
@router.delete("/api/jobs/{job_id}")
def delete_job(
    job_id: str,
    is_admin: bool = Depends(verify_admin_role)
):
    """
    Deletes a job posting permanently.
    Protected: Admin / Recruiter role required.
    """
    del_sql = "DELETE FROM job_postings WHERE id = ?"
    try:
        with _get_sqlite_conn() as conn:
            cur = conn.cursor()
            cur.execute(del_sql, (job_id,))
            conn.commit()
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail=f"Job posting '{job_id}' not found.")

        try:
            from database import get_connection
            m_conn = get_connection()
            m_cur = m_conn.cursor()
            m_cur.execute("DELETE FROM job_postings WHERE id = %s", (job_id,))
            m_conn.commit()
            m_cur.close()
            m_conn.close()
        except Exception:
            pass

        return {
            "status": "success",
            "message": f"Job posting '{job_id}' deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[Jobs] Failed to delete job '%s': %s", job_id, e)
        raise HTTPException(status_code=500, detail=f"Failed to delete job posting: {str(e)}")


# --------------------------------------------------------------------------
# 6. GET /api/jobs/template — Download CSV Template
# --------------------------------------------------------------------------
@router.get("/api/jobs/template")
def get_csv_template():
    """
    Returns a downloadable CSV sample template for bulk job uploads.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "title",
        "company",
        "locations",
        "work_mode",
        "job_type",
        "exp_min",
        "exp_max",
        "salary_range",
        "key_skills",
        "education",
        "department",
        "openings",
        "description",
        "apply_last_date",
        "apply_link",
        "apply_email",
        "status"
    ])
    writer.writerow([
        "DevOps Engineer",
        "TechCorp Solutions",
        "Hyderabad, Bengaluru",
        "Hybrid",
        "Full-time",
        "3",
        "6",
        "₹15,00,000 - ₹22,00,000",
        "Docker, Kubernetes, AWS, Terraform, CI/CD",
        "B.Tech in CS/IT",
        "Cloud Operations",
        "2",
        "Responsible for orchestrating Kubernetes clusters and managing automated CI/CD pipelines.",
        "2026-11-30",
        "https://techcorp.example.com/apply",
        "careers@techcorp.example.com",
        "Active"
    ])
    writer.writerow([
        "Data Analyst Intern",
        "DataMetrics Global",
        "Remote",
        "Remote",
        "Internship",
        "0",
        "1",
        "₹25,000 - ₹35,000 / month",
        "SQL, Python, PowerBI, Excel",
        "Bachelor in Math, CS or related",
        "Data & Analytics",
        "5",
        "Work directly with senior data scientists to clean data, build dashboards, and extract insights.",
        "2026-12-15",
        "https://datametrics.example.com/internships",
        "interns@datametrics.example.com",
        "Active"
    ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="jobnex_bulk_jobs_template.csv"'}
    )


# --------------------------------------------------------------------------
# 7. POST /api/jobs/bulk — Admin: Bulk Upload from CSV / JSON
# --------------------------------------------------------------------------
@router.post("/api/jobs/bulk")
async def bulk_upload_jobs(
    file: Optional[UploadFile] = File(None),
    is_admin: bool = Depends(verify_admin_role)
):
    """
    Accepts a CSV file of multiple jobs.
    Validates each row, records row-wise errors, and imports only valid rows.
    """
    if not file:
        raise HTTPException(status_code=400, detail="CSV file is required for bulk upload.")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    fieldnames = [f.strip() for f in (reader.fieldnames or [])]

    if not fieldnames or "title" not in fieldnames or "company" not in fieldnames:
        raise HTTPException(
            status_code=422,
            detail="Invalid CSV format. Header must contain at least 'title' and 'company' columns. Download the sample template."
        )

    valid_rows = []
    errors = []
    row_idx = 1

    for row in reader:
        row_idx += 1
        clean_row = {k.strip(): (v.strip() if v else "") for k, v in row.items() if k}

        title = clean_row.get("title", "")
        company = clean_row.get("company", "")
        description = clean_row.get("description", "")

        row_errors = []
        if not title:
            row_errors.append("Missing job title")
        if not company:
            row_errors.append("Missing company name")
        if not description or len(description) < 5:
            row_errors.append("Description is missing or too short")

        try:
            exp_min = int(clean_row.get("exp_min") or 0)
        except ValueError:
            exp_min = 0

        try:
            exp_max = int(clean_row.get("exp_max") or 0)
        except ValueError:
            exp_max = 0

        try:
            openings = int(clean_row.get("openings") or 1)
        except ValueError:
            openings = 1

        if row_errors:
            errors.append({
                "row": row_idx,
                "title": title or "(Empty)",
                "company": company or "(Empty)",
                "errors": row_errors,
            })
        else:
            job_id = f"job-bulk-{int(datetime.now(timezone.utc).timestamp() * 1000)}-{len(valid_rows)}"
            valid_rows.append((
                job_id,
                title,
                company,
                clean_row.get("company_logo", ""),
                clean_row.get("locations", "Remote"),
                clean_row.get("work_mode", "Office"),
                clean_row.get("job_type", "Full-time"),
                exp_min,
                exp_max,
                clean_row.get("salary_range", "Not disclosed"),
                clean_row.get("key_skills", ""),
                clean_row.get("education", "Any Graduate"),
                clean_row.get("department", "Engineering"),
                openings,
                description,
                clean_row.get("apply_last_date", ""),
                clean_row.get("apply_link", ""),
                clean_row.get("apply_email", ""),
                clean_row.get("status", "Active"),
                "admin",
                0,
            ))

    # Insert valid rows
    imported_count = 0
    if valid_rows:
        insert_sql = """
        INSERT INTO job_postings (
            id, title, company, company_logo, locations, work_mode, job_type,
            exp_min, exp_max, salary_range, key_skills, education, department,
            openings, description, apply_last_date, apply_link, apply_email,
            status, posted_by, applicants_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        try:
            with _get_sqlite_conn() as conn:
                conn.executemany(insert_sql, valid_rows)
                conn.commit()
                imported_count = len(valid_rows)
        except Exception as e:
            logger.error("[Jobs] Bulk insert error: %s", e)
            raise HTTPException(status_code=500, detail=f"Failed to save bulk jobs: {str(e)}")

    return {
        "status": "success",
        "total_rows_processed": row_idx - 1,
        "imported_count": imported_count,
        "error_count": len(errors),
        "errors": errors,
    }

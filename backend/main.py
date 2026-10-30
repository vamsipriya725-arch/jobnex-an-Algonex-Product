import json
import logging
import os
import sys
import urllib.request
from html.parser import HTMLParser
from contextlib import asynccontextmanager
from datetime import date as date_type
from pathlib import Path
from typing import Optional

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI, HTTPException, Query, Response, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from database import get_connection
from analyzer import analyze_resume, analyse_resume
from resume_privacy import router as resume_router, redact_text, save_to_vault, count_pii_entities
from filter_logic import router as filter_router
from ats_resume_generator import router as ats_resume_router

import apply_db
import auto_apply
import daily_db
import daily_jobs
import daily_scheduler
from job_fetcher import fetch_jobs, JobFetchError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the daily trigger when the API starts, stop it when the API stops.
    daily_scheduler.start()
    yield
    daily_scheduler.shutdown()


app = FastAPI(lifespan=lifespan)

# Include feature routers
app.include_router(resume_router)
app.include_router(filter_router)
app.include_router(ats_resume_router)

# Jobs Management (JobNex Careers & Admin Postings)
try:
    from job_management import router as jobs_management_router
    app.include_router(jobs_management_router)
    logger.info('Successfully mounted Job Management router (/api/jobs)')
except Exception as e:
    logger.warning('Could not include job_management router: %s', e)

# Community jobs (users upload jobs for others)
try:
    from community_jobs import router as community_jobs_router
    app.include_router(community_jobs_router)
except Exception as e:
    logger.warning("Could not include community_jobs router: %s", e)

try:
    from resume_builder import router as resume_builder_router, get_job_status, cancel_job_endpoint
    app.include_router(resume_builder_router)
    # Direct alias endpoints matching exact requirement GET /api/jobs/:id and POST /api/jobs/:id/cancel
    # GET /api/jobs/{job_id} handled comprehensively with upload fallback by jobs_management_router
    app.add_api_route("/api/jobs/{job_id}/cancel", cancel_job_endpoint, methods=["POST"], tags=["Job Status"])
    logger.info("Successfully mounted Resume Builder router and /api/jobs aliases")
except Exception as e:
    logger.warning("Could not include resume_builder router: %s", e)

# Mount Auth router (users table for register, login, me)
try:
    if str(backend_dir.parent) not in sys.path:
        sys.path.insert(0, str(backend_dir.parent))
    import login as auth_module
    app.include_router(auth_module.app.router)
    logger.info("Successfully mounted auth router in FastAPI backend")
except Exception as e:
    logger.warning("Could not include auth router: %s", e)


# Routers from openmind
try:
    from interview_prep import router as interview_prep_router
    app.include_router(interview_prep_router)
except ImportError:
    logger.warning("interview_prep router not found, skipping inclusion.")

try:
    from chatbot_assistant import create_router as create_chat_router
    app.include_router(create_chat_router())
except ImportError:
    logger.warning("chatbot_assistant router not found, skipping inclusion.")

try:
    from suggestions_resources import create_router as create_suggestions_router
    suggestions_router = create_suggestions_router()
    app.include_router(suggestions_router)
    # Also mount with /api/skill-gap prefix for direct skill-gap route semantics
    app.include_router(suggestions_router, prefix="/api/skill-gap")
except Exception as e:
    logger.warning("Could not include suggestions router: %s", e)


try:
    from application_dashboard import create_router as create_dashboard_router
    app.include_router(create_dashboard_router())
except Exception as e:
    logger.warning("Could not initialize dashboard router: %s", e)

# Mount Frontend static files for unified access
try:
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse
    frontend_dir = backend_dir.parent / "Frontend"
    if (frontend_dir / "frontend").exists():
        app.mount("/frontend", StaticFiles(directory=str(frontend_dir / "frontend"), html=True), name="frontend_portal")
    if frontend_dir.exists():
        app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="frontend_static")
except Exception as e:
    logger.warning("Could not mount static frontend files: %s", e)

# Direct HTML page routes for /jobs, /admin/jobs, and /jobs/{job_id}
@app.get("/jobs", include_in_schema=False)
def serve_jobs_page():
    p = backend_dir.parent / "Frontend" / "frontend" / "pages" / "jobs.html"
    if p.exists():
        return FileResponse(p)
    raise HTTPException(status_code=404, detail="jobs.html not found")

@app.get("/jobs/{job_id}", include_in_schema=False)
def serve_job_details_page(job_id: str):
    p = backend_dir.parent / "Frontend" / "frontend" / "pages" / "job-details.html"
    if p.exists():
        return FileResponse(p)
    raise HTTPException(status_code=404, detail="job-details.html not found")

@app.get("/admin/jobs", include_in_schema=False)
def serve_admin_jobs_page():
    p = backend_dir.parent / "Frontend" / "frontend" / "pages" / "admin-jobs.html"
    if p.exists():
        return FileResponse(p)
    raise HTTPException(status_code=404, detail="admin-jobs.html not found")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "*"
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/frontend") or path.startswith("/static") or path.endswith((".html", ".js", ".css")):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


class AnalyzeRequest(BaseModel):
    user_email: Optional[str] = None
    resume_text: str = Field(..., min_length=1)
    jd_text: str = Field(..., min_length=1)
    use_ai: bool = True

    @field_validator("resume_text", "jd_text")
    @classmethod
    def not_blank_valid(cls, value):
        if not value.strip():
            raise ValueError("Fill without spaces")
        return value


class FetchJDRequest(BaseModel):
    url: str


class HTMLTextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.fed = []
        self.ignore = False
        self.ignore_tags = {"script", "style", "nav", "footer", "header", "noscript", "svg", "iframe"}

    def handle_starttag(self, tag, attrs):
        if tag.lower() in self.ignore_tags:
            self.ignore = True

    def handle_endtag(self, tag):
        if tag.lower() in self.ignore_tags:
            self.ignore = False

    def handle_data(self, d):
        if not self.ignore and d.strip():
            self.fed.append(d.strip())

    def get_text(self):
        return "\n".join(self.fed)


analyseRequest = AnalyzeRequest


@app.get("/")
def home():
    return {
        "message": "Resume Analyzer Backend is Running"
    }


@app.get("/favicon.ico", include_in_schema=False)
@app.get("/favicon.png", include_in_schema=False)
def favicon():
    return Response(status_code=204)


@app.post("/api/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    """Accepts PDF, DOCX, or TXT file and extracts plaintext using extract_text_from_file and skills_extractor."""
    filename = file.filename or "resume.pdf"
    content = await file.read()
    text = ""

    try:
        from ats_resume_generator import extract_text_from_file
        from skills_extractor import extract_skills, format_skill_for_display
        text = extract_text_from_file(content, filename)
        extracted = extract_skills(text, source="resume")
        core_skills = [format_skill_for_display(s) for s in extracted.get("all_skills", [])[:10]]
    except Exception as e:
        logger.warning("extract_text_from_file exception (%s), falling back to utf-8 decode", e)
        text = content.decode("utf-8", errors="ignore").strip()
        core_skills = []

    if not text:
        raise HTTPException(status_code=422, detail="No readable text found in uploaded file.")

    return {
        "status": "success",
        "filename": filename,
        "text": text,
        "char_count": len(text),
        "core_skills": core_skills,
    }


def _extract_jd_with_gemini(raw_text: str) -> Optional[str]:
    """Sends cleaned page text to Gemini to return only the job description as structured text."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=12000))
        prompt = (
            "From this page text, return only the job description (title, responsibilities, requirements, skills). "
            "Remove application form and website boilerplate. Return JSON.\n\n"
            "Return JSON matching this schema:\n"
            "{\n"
            '  "title": "job title",\n'
            '  "company": "company name or empty string",\n'
            '  "responsibilities": ["bullet 1", "bullet 2"],\n'
            '  "requirements": ["bullet 1", "bullet 2"],\n'
            '  "skills": ["skill 1", "skill 2"]\n'
            "}\n\n"
            "Page text:\n"
            f"{raw_text[:7000]}"
        )

        for model_name in ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-flash-lite-latest", "gemini-3.8-flash"]:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config={"response_mime_type": "application/json"}
                )
                if response and response.text:
                    cleaned_json = response.text.strip()
                    if cleaned_json.startswith("```json"):
                        cleaned_json = cleaned_json[7:]
                    if cleaned_json.startswith("```"):
                        cleaned_json = cleaned_json[3:]
                    if cleaned_json.endswith("```"):
                        cleaned_json = cleaned_json[:-3]
                    data = json.loads(cleaned_json.strip())

                    # Format into a clean, human-readable Job Description
                    sections = []
                    title = data.get("title", "").strip()
                    company = data.get("company", "").strip()
                    if title:
                        header = f"Job Title: {title}"
                        if company:
                            header += f" at {company}"
                        sections.append(header)

                    resps = data.get("responsibilities", [])
                    if resps:
                        sections.append("Responsibilities:\n" + "\n".join(f"- {r}" for r in resps if r))

                    reqs = data.get("requirements", [])
                    if reqs:
                        sections.append("Requirements & Qualifications:\n" + "\n".join(f"- {r}" for r in reqs if r))

                    skills = data.get("skills", [])
                    if skills:
                        sections.append("Required Skills:\n" + "\n".join(f"- {s}" for s in skills if s))

                    if sections:
                        return "\n\n".join(sections)
            except Exception as e:
                logger.debug("Gemini JD extraction model %s error: %s", model_name, e)
                continue
    except Exception as e:
        logger.warning("Gemini JD extraction client error: %s", e)

    return None


@app.post("/api/fetch-jd-url")
def fetch_jd_from_url(req: FetchJDRequest):
    """
    Fetches job description from URL. Strips scripts, styles, forms, buttons, inputs, and boilerplate.
    Guards against JS-rendered / empty pages (like Dover) and returns a clear manual-paste instruction.
    Uses Gemini to extract clean title, responsibilities, requirements, and skills.
    """
    url = req.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    try:
        import requests
        from bs4 import BeautifulSoup

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        resp = requests.get(url, headers=headers, timeout=12)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")

        # 1. Remove script, style, nav, header, footer, form, button, input and interactive noise
        for tag in soup([
            "script", "style", "nav", "header", "footer", "form",
            "button", "input", "noscript", "svg", "iframe", "select", "textarea"
        ]):
            tag.decompose()

        # 2. Extract and filter text lines, dropping application-form and boilerplate noise
        boilerplate_patterns = [
            r"drag\s+and\s+drop",
            r"browse\s+computer",
            r"pdf\s+or\s+docx",
            r"maximum\s+\d+\s*mb",
            r"resume\s*\*",
            r"jobs\s+powered\s+by",
            r"by\s+applying\s+you\s+agree",
            r"terms\s+of\s+(service|use)",
            r"privacy\s+policy",
            r"dover\s+logo",
            r"you\s+need\s+to\s+enable\s+javascript",
            r"sign\s+in\s+to\s+apply",
            r"cookie\s+policy",
            r"accept\s+all\s+cookies",
            r"powered\s+by",
        ]

        cleaned_lines = []
        import re
        for text_part in soup.stripped_strings:
            line = text_part.strip()
            if len(line) < 2:
                continue
            if any(re.search(pat, line, re.IGNORECASE) for pat in boilerplate_patterns):
                continue
            cleaned_lines.append(line)

        cleaned_text = "\n".join(cleaned_lines).strip()

        # 3. Guard against JS-rendered client-side sites (like Dover) or empty pages
        if len(cleaned_text) < 150 or "you need to enable javascript" in resp.text.lower():
            logger.info("Fetched page for %s is JS-rendered or too short (%d chars). Prompting manual paste.", url, len(cleaned_text))
            raise HTTPException(
                status_code=400,
                detail="Couldn't read this page automatically. Please paste the job description manually."
            )

        # 4. Use Gemini to extract structured job description (title, responsibilities, requirements, skills)
        extracted_jd = _extract_jd_with_gemini(cleaned_text)
        final_jd_text = extracted_jd if extracted_jd else cleaned_text[:8000]

        return {
            "status": "success",
            "url": url,
            "jd_text": final_jd_text,
            "char_count": len(final_jd_text),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Failed to fetch JD from %s: %s", url, e)
        raise HTTPException(
            status_code=400,
            detail="Couldn't read this page automatically. Please paste the job description manually."
        )


@app.post("/api/analyze")
@app.post("/api/analyse")
def analyze(request: AnalyzeRequest):
    result = analyze_resume(request.resume_text, request.jd_text, use_ai=request.use_ai)
    safe_resume_text = redact_text(request.resume_text)

    connection = None
    cursor = None
    analysis_id = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        query = """
            INSERT INTO resume_analyzer
                (user_email, resume_text, jd_text, matched_skills, missing_skills, matched_score, suggestions)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """

        cursor.execute(
            query,
            (
                request.user_email,
                safe_resume_text,
                request.jd_text,
                json.dumps(result["matched_skills"]),
                json.dumps(result["missing_skills"]),
                result["matched_score"],
                json.dumps(result["suggestions"]),
            ),
        )

        connection.commit()
        analysis_id = cursor.lastrowid

        # Save original unredacted resume in secure privacy vault for authorized reveal
        try:
            save_to_vault(connection, analysis_id, request.resume_text, count_pii_entities(request.resume_text), request.user_email)
            connection.commit()
        except Exception as vault_err:
            logger.warning("Could not save to privacy vault: %s", vault_err)

    except Exception as error:
        if connection is not None and getattr(connection, "is_connected", lambda: True)():
            connection.rollback()
        logger.exception("Failed to save resume analysis")
        raise HTTPException(
            status_code=500,
            detail="Failed to save analysis"
        ) from error

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and getattr(connection, "is_connected", lambda: True)():
            connection.close()

    return {
        "Analysis_Id": analysis_id,
        "redacted_resume": safe_resume_text,
        **result,
    }


# Backend API: Retrieve analysis history
@app.get("/api/analyses")
def get_analyses():
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT
                Analysis_Id AS id,
                Analysis_Id,
                matched_score,
                matched_skills,
                missing_skills,
                created_At AS created_at,
                created_At
            FROM resume_analyzer
            ORDER BY Analysis_Id DESC
            LIMIT 20
        """

        cursor.execute(query)
        analyses = cursor.fetchall()

        for analysis in analyses:
            analysis["Analysis_id"] = analysis.get("id")
            analysis["created_At"] = analysis.get("created_at")
            for field in ("matched_skills", "missing_skills"):
                value = analysis.get(field)
                if isinstance(value, str):
                    analysis[field] = json.loads(value)

        return {"analyses": analyses}

    except Exception as error:
        logger.exception("Failed to retrieve analyses")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve analyses"
        ) from error

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and getattr(connection, "is_connected", lambda: True)():
            connection.close()


# ---------------- Auto-apply feature ----------------

class queueApplicationRequest(BaseModel):
    resume_text: str
    job_title: str
    company: str
    job_description: str
    job_url: Optional[str] = None
    apply_email: Optional[str] = None


# Step 1: find real jobs for a keyword
@app.get("/api/jobs/search")
def search_jobs(keyword: str = Query(..., min_length=2), limit: int = 10):
    try:
        return {"jobs": fetch_jobs(keyword, limit)}
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except JobFetchError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


# Step 2: score the job, write a cover letter and queue it for approval
@app.post("/api/applications")
def queue_application(request: queueApplicationRequest):
    try:
        return auto_apply.queue_application(
            request.resume_text,
            request.job_title,
            request.company,
            request.job_description,
            request.job_url,
            request.apply_email,
        )
    except auto_apply.DuplicateApplicationError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except (auto_apply.InvalidApplicationError, auto_apply.LowMatchError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Failed to queue application"
        ) from error


# Step 3: list every queued / sent application
@app.get("/api/applications")
def get_applications():
    try:
        return {"applications": apply_db.list_applications()}
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve applications"
        ) from error


# Step 4: the user approves one application and it is sent
@app.post("/api/applications/{application_id}/approve")
def approve_application(application_id: int):
    try:
        return auto_apply.apply_to_application(application_id)
    except auto_apply.ApplicationNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except auto_apply.DailyLimitError as error:
        raise HTTPException(status_code=429, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Failed to send application"
        ) from error


# ---------------- Daily matches feature ----------------

class DailySettingsRequest(BaseModel):
    resume_text: str = Field(..., min_length=20)
    keywords: str = Field(..., min_length=2)
    min_score: float = Field(60, ge=0, le=100)
    run_hour: int = Field(9, ge=0, le=23)
    run_minute: int = Field(0, ge=0, le=59)
    enabled: bool = True


def _settings_response():
    settings = daily_db.get_settings()
    last_run = settings["last_run_date"]
    settings["last_run_date"] = last_run.isoformat() if last_run else None
    settings["next_run"] = daily_scheduler.next_run_time()
    return settings


# Read the saved resume / keywords / threshold / run time
@app.get("/api/daily/settings")
def get_daily_settings():
    try:
        daily_db.create_tables()
        return _settings_response()
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Failed to load daily settings"
        ) from error


# Save them and move the daily trigger to the new time
@app.put("/api/daily/settings")
def save_daily_settings(request: DailySettingsRequest):
    if not daily_jobs.split_keywords(request.keywords):
        raise HTTPException(status_code=422, detail="Add at least one keyword")

    try:
        daily_db.create_tables()
        daily_db.save_settings(
            request.resume_text.strip(),
            request.keywords.strip(),
            request.min_score,
            request.run_hour,
            request.run_minute,
            request.enabled,
        )
        daily_scheduler.apply_schedule(
            request.enabled, request.run_hour, request.run_minute
        )
        return _settings_response()
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Failed to save daily settings"
        ) from error


# Run the daily job right now (same code the trigger runs every day)
@app.post("/api/daily/run")
def run_daily_now():
    try:
        return daily_jobs.run_daily()
    except daily_jobs.RunAlreadyActiveError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except daily_jobs.DailyRunError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Daily run failed"
        ) from error


# The UI list: ONE day (default today), only jobs at or above the match percent
@app.get("/api/daily/jobs")
def get_daily_jobs(
    min_score: Optional[float] = Query(None, ge=0, le=100),
    day: Optional[date_type] = None,
):
    try:
        run_date = day or daily_jobs.today()

        if min_score is None:
            min_score = daily_db.get_settings()["min_score"]

        jobs = daily_db.list_matches(run_date, min_score)
        total = daily_db.count_matches(run_date)

        return {
            "date": run_date.isoformat(),
            "min_score": min_score,
            "count": len(jobs),
            "hidden_below_min": total - len(jobs),
            "jobs": jobs,
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve daily jobs"
        ) from error


# Retrieve all registered users from database / profiles
@app.get("/api/users")
def get_all_users():
    conn = None
    cur = None
    try:
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT id, email, full_name, avatar_url, auth_provider, is_active, created_at FROM users ORDER BY id DESC")
        users = cur.fetchall()
        for u in users:
            if u.get("created_at"):
                u["created_at"] = str(u["created_at"])
        return {"success": True, "count": len(users), "users": users}
    except Exception as e:
        logger.exception("Failed to query users: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cur: cur.close()
        if conn and getattr(conn, "is_connected", lambda: True)(): conn.close()


# Save resume analysis record
class SaveAnalysisRequest(BaseModel):
    user_email: Optional[str] = None
    resume_text: str
    jd_text: str
    matched_score: float
    matched_skills: list = []
    missing_skills: list = []
    suggestions: list = []

@app.post("/api/save-analysis")
def save_analysis(req: SaveAnalysisRequest):
    conn = None
    cur = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        query = """
            INSERT INTO resume_analyzer
                (user_email, resume_text, jd_text, matched_score, matched_skills, missing_skills, suggestions, created_At)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        """
        cur.execute(query, (
            req.user_email,
            redact_text(req.resume_text),
            req.jd_text,
            req.matched_score,
            json.dumps(req.matched_skills),
            json.dumps(req.missing_skills),
            json.dumps(req.suggestions),
        ))
        conn.commit()
        return {
            "success": True,
            "id": cur.lastrowid,
            "user_email": req.user_email,
            "message": "Analysis successfully stored in database",
        }
    except Exception as e:
        if conn: conn.rollback()
        logger.exception("Failed to save analysis: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cur: cur.close()
        if conn and getattr(conn, "is_connected", lambda: True)(): conn.close()


# Manage Candidate Profiles
class CandidateProfileIn(BaseModel):
    user_id: int = 1
    title: Optional[str] = "Full Stack Engineer"
    bio: Optional[str] = ""
    location: Optional[str] = "Remote"
    years_experience: Optional[int] = 3
    resume_url: Optional[str] = ""
    skills: list = []

@app.post("/api/candidate/profile")
def save_candidate_profile(p: CandidateProfileIn):
    conn = None
    cur = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        query = """
            INSERT INTO candidate_profiles
                (user_id, title, bio, location, years_experience, resume_url, skills, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                title = VALUES(title),
                bio = VALUES(bio),
                location = VALUES(location),
                years_experience = VALUES(years_experience),
                resume_url = VALUES(resume_url),
                skills = VALUES(skills),
                updated_at = NOW()
        """
        cur.execute(query, (
            p.user_id, p.title, p.bio, p.location, p.years_experience, p.resume_url, json.dumps(p.skills)
        ))
        conn.commit()
        return {"success": True, "message": "Candidate profile saved successfully"}
    except Exception as e:
        if conn: conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cur: cur.close()
        if conn and getattr(conn, "is_connected", lambda: True)(): conn.close()
@app.get("/api/config/supabase")
def get_supabase_public_config():
    """Returns public Supabase URL and ANON Key. Never exposes Service Role Key."""
    return {
        "supabase_url": os.getenv("SUPABASE_URL", "https://your-project-id.supabase.co"),
        "supabase_anon_key": os.getenv("SUPABASE_ANON_KEY", "your_supabase_anon_key_here")
    }

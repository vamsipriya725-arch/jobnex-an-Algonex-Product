import json
import logging
import os
import sys
from contextlib import asynccontextmanager
from datetime import date as date_type
from pathlib import Path
from typing import Optional

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from database import get_connection
from analyzer import analyze_resume, analyse_resume
from resume_privacy import router as resume_router, redact_text
from filter_logic import router as filter_router

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

# Include Bhavani's feature routers
app.include_router(resume_router)
app.include_router(filter_router)

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
    app.include_router(create_suggestions_router())
except ImportError:
    pass

try:
    from application_dashboard import create_router as create_dashboard_router
    app.include_router(create_dashboard_router())
except Exception as e:
    logger.warning("Could not connect to MySQL for dashboard router: %s", e)
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


class AnalyzeRequest(BaseModel):
    resume_text: str = Field(..., min_length=1)
    jd_text: str = Field(..., min_length=1)

    @field_validator("resume_text", "jd_text")
    @classmethod
    def not_blank_valid(cls, value):
        if not value.strip():
            raise ValueError("Fill without spaces")
        return value


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


@app.post("/api/analyze")
@app.post("/api/analyse")
def analyze(request: AnalyzeRequest):
    result = analyze_resume(request.resume_text, request.jd_text)
    safe_resume_text = redact_text(request.resume_text)

    connection = None
    cursor = None
    analysis_id = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        query = """
            INSERT INTO resume_analyzer
                (resume_text, jd_text, matched_skills, missing_skills, matched_score, suggestions)
            VALUES (%s, %s, %s, %s, %s, %s)
        """

        cursor.execute(
            query,
            (
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
                Analysis_id,
                matched_score,
                matched_skills,
                missing_skills,
                created_At
            FROM resume_analyzer
            ORDER BY Analysis_id DESC
            LIMIT 20
        """

        cursor.execute(query)
        analyses = cursor.fetchall()

        for analysis in analyses:
            for field in ("matched_skills", "missing_skills"):
                value = analysis[field]
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

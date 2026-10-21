"""
Automatic Job Referral Emails - FastAPI backend

Features
- Register candidates (skills, experience, location)
- Post jobs
- Auto-match candidates to jobs by skill overlap and email them automatically
- Manual referral: refer a candidate to a job (sends referral email)
- Daily scheduled run that emails new matches (no duplicates)
- Email log / history

Install:
    pip install fastapi "uvicorn[standard]" sqlalchemy pydantic[email] apscheduler python-dotenv

.env file:
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=yourmail@gmail.com
    SMTP_PASSWORD=your_app_password
    FROM_EMAIL=yourmail@gmail.com
    DATABASE_URL=sqlite:///./referrals.db
    MATCH_THRESHOLD=40

Run:
    uvicorn main:app --reload
Docs:
    http://127.0.0.1:8000/docs
"""

import os
import smtplib
from contextlib import asynccontextmanager
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional

from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import (Boolean, Column, DateTime, ForeignKey, Integer, String,
                        Text, UniqueConstraint, create_engine)
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker

load_dotenv()

# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./referrals.db")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USER)
MATCH_THRESHOLD = int(os.getenv("MATCH_THRESHOLD", "40"))  # min match % to email

# ----------------------------------------------------------------------------
# Database
# ----------------------------------------------------------------------------
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class Candidate(Base):
    __tablename__ = "candidates"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    skills = Column(Text, nullable=False)  # comma separated, lowercase
    experience_years = Column(Integer, default=0)
    location = Column(String(120), default="")
    subscribed = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    company = Column(String(200), nullable=False)
    description = Column(Text, default="")
    required_skills = Column(Text, nullable=False)  # comma separated, lowercase
    min_experience = Column(Integer, default=0)
    location = Column(String(120), default="")
    apply_url = Column(String(500), default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class EmailTemplate(Base):
    __tablename__ = "email_templates"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    subject_template = Column(String(255), nullable=False)
    html_template = Column(Text, nullable=False)
    description = Column(String(255), default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class EmailLog(Base):
    __tablename__ = "email_logs"
    __table_args__ = (UniqueConstraint("candidate_id", "job_id", "kind", name="uq_candidate_job_kind"),)
    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    kind = Column(String(20), default="auto")  # auto | referral
    match_score = Column(Integer, default=0)
    subject = Column(String(255), default="")
    body = Column(Text, default="")
    status = Column(String(50), default="sent")  # sent | failed | generated (preview)
    error = Column(Text, default="")
    sent_at = Column(DateTime, default=datetime.utcnow)

    candidate = relationship("Candidate")
    job = relationship("Job")


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ----------------------------------------------------------------------------
# Schemas
# ----------------------------------------------------------------------------
def _norm_skills(skills: List[str]) -> str:
    return ",".join(sorted({s.strip().lower() for s in skills if s.strip()}))


class CandidateIn(BaseModel):
    name: str
    email: EmailStr
    skills: List[str]
    experience_years: int = 0
    location: str = ""


class CandidateOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    skills: str
    experience_years: int
    location: str
    subscribed: bool

    class Config:
        from_attributes = True


class JobIn(BaseModel):
    title: str
    company: str
    description: str = ""
    required_skills: List[str]
    min_experience: int = 0
    location: str = ""
    apply_url: str = ""


class JobOut(BaseModel):
    id: int
    title: str
    company: str
    required_skills: str
    min_experience: int
    location: str
    apply_url: str
    is_active: bool

    class Config:
        from_attributes = True


class ReferralIn(BaseModel):
    job_id: int
    candidate_id: int
    referrer_name: str
    message: Optional[str] = ""


class EmailTemplateOut(BaseModel):
    id: int
    name: str
    subject_template: str
    html_template: str
    description: str

    class Config:
        from_attributes = True


class EmailLogOut(BaseModel):
    id: int
    candidate_id: int
    job_id: int
    kind: str
    match_score: int
    subject: str
    body: str
    status: str
    error: str
    sent_at: datetime

    class Config:
        from_attributes = True


# ----------------------------------------------------------------------------
# Matching logic
# ----------------------------------------------------------------------------
def calc_match_score(candidate: Candidate, job: Job) -> int:
    """Percentage of job's required skills the candidate has, with
    experience and location checks."""
    job_skills = {s for s in job.required_skills.split(",") if s}
    cand_skills = {s for s in candidate.skills.split(",") if s}
    if not job_skills:
        return 0

    score = len(job_skills & cand_skills) / len(job_skills) * 100

    if candidate.experience_years < job.min_experience:
        score *= 0.5  # penalise if under-experienced

    if job.location and candidate.location:
        if job.location.lower() != candidate.location.lower() and job.location.lower() != "remote":
            score *= 0.8  # small penalty for different location

    return int(score)


# ----------------------------------------------------------------------------
# Email
# ----------------------------------------------------------------------------
def send_email(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    if not SMTP_USER or not SMTP_PASSWORD:
        raise RuntimeError("SMTP credentials are not configured")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = FROM_EMAIL
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(FROM_EMAIL, [to_email], msg.as_string())


def build_job_email(candidate: Candidate, job: Job, score: int,
                    referrer: Optional[str] = None, note: str = ""):
    intro = (
        f"{referrer} has referred you for this opportunity."
        if referrer
        else "Based on your profile, we found a job that matches your skills."
    )
    subject = f"Job Referral: {job.title} at {job.company}"
    apply_line = f'<p><a href="{job.apply_url}">Apply here</a></p>' if job.apply_url else ""

    html = f"""
    <html><body style="font-family:Arial,sans-serif;color:#222">
      <p>Hi {candidate.name},</p>
      <p>{intro}</p>
      <table cellpadding="6" style="border-collapse:collapse">
        <tr><td><b>Role</b></td><td>{job.title}</td></tr>
        <tr><td><b>Company</b></td><td>{job.company}</td></tr>
        <tr><td><b>Location</b></td><td>{job.location or 'Not specified'}</td></tr>
        <tr><td><b>Skills</b></td><td>{job.required_skills}</td></tr>
        <tr><td><b>Match</b></td><td>{score}%</td></tr>
      </table>
      <p>{job.description[:500]}</p>
      {f'<p><i>Note from referrer: {note}</i></p>' if note else ''}
      {apply_line}
      <p>Best of luck!<br>Job Referral Team</p>
    </body></html>
    """
    text = (
        f"Hi {candidate.name},\n\n{intro}\n\n"
        f"Role: {job.title}\nCompany: {job.company}\n"
        f"Location: {job.location or 'Not specified'}\nMatch: {score}%\n\n"
        f"{job.description[:500]}\n\n"
        f"{('Note from referrer: ' + note) if note else ''}\n"
        f"{('Apply: ' + job.apply_url) if job.apply_url else ''}\n\nJob Referral Team"
    )
    return subject, html, text


def dispatch_email(db: Session, candidate: Candidate, job: Job, score: int,
                   kind: str = "auto", referrer: Optional[str] = None, note: str = "") -> bool:
    """Send one email and log it. Skips if already sent for same (candidate, job, kind)."""
    exists = (
        db.query(EmailLog)
        .filter_by(candidate_id=candidate.id, job_id=job.id, kind=kind)
        .first()
    )
    if exists and exists.status == "sent":
        return False

    log = exists or EmailLog(candidate_id=candidate.id, job_id=job.id, kind=kind)
    log.match_score = score
    try:
        subject, html, text = build_job_email(candidate, job, score, referrer, note)
        log.subject = subject
        log.body = html
        if SMTP_USER and SMTP_PASSWORD:
            send_email(candidate.email, subject, html, text)
            log.status, log.error = "sent", ""
        else:
            log.status, log.error = "generated (preview)", ""
    except Exception as exc:  # noqa: BLE001
        log.status, log.error = "failed", str(exc)

    log.sent_at = datetime.utcnow()
    db.add(log)
    db.commit()
    return "sent" in log.status or "generated" in log.status


def match_and_email_job(db: Session, job: Job) -> int:
    sent = 0
    candidates = db.query(Candidate).filter_by(subscribed=True).all()
    for cand in candidates:
        score = calc_match_score(cand, job)
        if score >= MATCH_THRESHOLD and dispatch_email(db, cand, job, score, "auto"):
            sent += 1
    return sent


def run_matching_all() -> int:
    """Used by the scheduler: email every active job's new matches."""
    db = SessionLocal()
    try:
        total = 0
        for job in db.query(Job).filter_by(is_active=True).all():
            total += match_and_email_job(db, job)
        return total
    finally:
        db.close()


def _bg_match_job(job_id: int) -> None:
    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        if job and job.is_active:
            match_and_email_job(db, job)
    finally:
        db.close()


# ----------------------------------------------------------------------------
# App + scheduler
# ----------------------------------------------------------------------------
scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(run_matching_all, "cron", hour=9, minute=0, id="daily_matching",
                      replace_existing=True)  # every day at 09:00
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="Automatic Job Referral Emails", version="1.0.0", lifespan=lifespan)


@app.get("/")
def health():
    return {"status": "ok", "service": "job-referral-emails"}


# ---- Candidates ------------------------------------------------------------
@app.post("/candidates", response_model=CandidateOut, status_code=201)
def create_candidate(payload: CandidateIn, db: Session = Depends(get_db)):
    if db.query(Candidate).filter_by(email=payload.email).first():
        raise HTTPException(409, "Candidate with this email already exists")
    cand = Candidate(
        name=payload.name,
        email=payload.email,
        skills=_norm_skills(payload.skills),
        experience_years=payload.experience_years,
        location=payload.location,
    )
    db.add(cand)
    db.commit()
    db.refresh(cand)
    return cand


@app.get("/candidates", response_model=List[CandidateOut])
def list_candidates(db: Session = Depends(get_db)):
    return db.query(Candidate).order_by(Candidate.id.desc()).all()


@app.patch("/candidates/{candidate_id}/unsubscribe", response_model=CandidateOut)
def unsubscribe(candidate_id: int, db: Session = Depends(get_db)):
    cand = db.get(Candidate, candidate_id)
    if not cand:
        raise HTTPException(404, "Candidate not found")
    cand.subscribed = False
    db.commit()
    db.refresh(cand)
    return cand


# ---- Jobs ------------------------------------------------------------------
@app.post("/jobs", response_model=JobOut, status_code=201)
def create_job(payload: JobIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    job = Job(
        title=payload.title,
        company=payload.company,
        description=payload.description,
        required_skills=_norm_skills(payload.required_skills),
        min_experience=payload.min_experience,
        location=payload.location,
        apply_url=payload.apply_url,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    # Automatic emails to matching candidates as soon as the job is posted
    background.add_task(_bg_match_job, job.id)
    return job


@app.get("/jobs", response_model=List[JobOut])
def list_jobs(db: Session = Depends(get_db)):
    return db.query(Job).order_by(Job.id.desc()).all()


@app.patch("/jobs/{job_id}/close", response_model=JobOut)
def close_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    job.is_active = False
    db.commit()
    db.refresh(job)
    return job


@app.get("/jobs/{job_id}/matches")
def job_matches(job_id: int, db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    results = []
    for cand in db.query(Candidate).filter_by(subscribed=True).all():
        score = calc_match_score(cand, job)
        if score > 0:
            results.append({"candidate_id": cand.id, "name": cand.name,
                            "email": cand.email, "match_score": score})
    return sorted(results, key=lambda r: r["match_score"], reverse=True)


# ---- Referrals -------------------------------------------------------------
@app.post("/referrals")
def refer_candidate(payload: ReferralIn, db: Session = Depends(get_db)):
    job = db.get(Job, payload.job_id)
    cand = db.get(Candidate, payload.candidate_id)
    if not job or not cand:
        raise HTTPException(404, "Job or candidate not found")
    score = calc_match_score(cand, job)
    ok = dispatch_email(db, cand, job, score, kind="referral",
                        referrer=payload.referrer_name, note=payload.message or "")
    if not ok:
        raise HTTPException(409, "Referral email already sent or failed. Check /email-logs")
    return {"message": "Referral email sent", "match_score": score}


# ---- Matching + logs -------------------------------------------------------
@app.post("/run-matching")
def run_matching_now(background: BackgroundTasks):
    """Manually trigger the same job the daily scheduler runs."""
    background.add_task(run_matching_all)
    return {"message": "Matching started in background"}


@app.get("/email-logs", response_model=List[EmailLogOut])
def email_logs(status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(EmailLog)
    if status:
        q = q.filter_by(status=status)
    return q.order_by(EmailLog.sent_at.desc()).limit(200).all()


@app.get("/email-templates", response_model=List[EmailTemplateOut])
def list_email_templates(db: Session = Depends(get_db)):
    return db.query(EmailTemplate).all()
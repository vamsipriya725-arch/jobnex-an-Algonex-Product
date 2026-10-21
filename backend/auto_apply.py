# auto_apply.py
# Core logic of the auto-apply feature:
#   1. score a job against the resume (reuses analyzer.py)
#   2. skip weak matches and duplicates
#   3. write a cover letter
#   4. queue the application, and send it by email only after the user approves
import os
import re
import smtplib
from email.message import EmailMessage
from pathlib import Path

from analyzer import analyze_resume
import apply_db

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


class ApplyError(Exception):
    pass


class InvalidApplicationError(ApplyError):
    pass


class DuplicateApplicationError(ApplyError):
    pass


class LowMatchError(ApplyError):
    pass


class ApplicationNotFoundError(ApplyError):
    pass


class DailyLimitError(ApplyError):
    pass


def _int_env(name, default):
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return int(default)


def is_valid_email(email):
    return bool(email) and re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email) is not None


def score_job(resume_text, job_description):
    return analyze_resume(resume_text, job_description)


def build_cover_letter(applicant_name, job_title, company, matched_skills):
    if matched_skills:
        skills_line = ", ".join(matched_skills)
    else:
        skills_line = "the skills listed in the role"

    return (
        f"Dear Hiring Team at {company},\n\n"
        f"I am writing to apply for the {job_title} position. "
        f"My background includes hands-on experience with {skills_line}, "
        f"which matches the requirements of this role.\n\n"
        f"I would welcome the chance to discuss how I can contribute to "
        f"{company}. My resume is attached for your review.\n\n"
        f"Thank you for your time and consideration.\n\n"
        f"Best regards,\n{applicant_name}"
    )


def queue_application(resume_text, job_title, company, job_description,
                      job_url=None, apply_email=None):
    resume_text = (resume_text or "").strip()
    job_title = (job_title or "").strip()
    company = (company or "").strip()
    job_description = (job_description or "").strip()

    if not (resume_text and job_title and company and job_description):
        raise InvalidApplicationError(
            "resume_text, job_title, company and job_description are required"
        )

    if apply_email and not is_valid_email(apply_email):
        raise InvalidApplicationError("apply_email is not a valid email address")

    if apply_db.find_duplicate(job_title, company):
        raise DuplicateApplicationError(
            f"You already have an application for {job_title} at {company}"
        )

    result = score_job(resume_text, job_description)
    min_score = _int_env("MIN_MATCH_SCORE", 40)

    if result["matched_score"] < min_score:
        raise LowMatchError(
            f"Match score {result['matched_score']} is below the minimum of {min_score}"
        )

    cover_letter = build_cover_letter(
        os.getenv("APPLICANT_NAME", "Applicant"),
        job_title,
        company,
        result["matched_skills"],
    )

    application_id = apply_db.add_application(
        job_title=job_title,
        company=company,
        job_description=job_description,
        match_score=result["matched_score"],
        cover_letter=cover_letter,
        job_url=job_url,
        apply_email=apply_email,
    )

    return apply_db.get_application(application_id)


def send_application_email(to_email, subject, body, resume_path=None):
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = _int_env("SMTP_PORT", 587)
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")

    if not user or not password:
        raise ApplyError("SMTP_USER and SMTP_PASSWORD are not configured in .env")

    sender = os.getenv("APPLICANT_EMAIL") or user

    message = EmailMessage()
    message["From"] = sender
    message["To"] = to_email
    message["Reply-To"] = sender
    message["Subject"] = subject
    message.set_content(body)

    if resume_path and Path(resume_path).is_file():
        path = Path(resume_path)
        message.add_attachment(
            path.read_bytes(),
            maintype="application",
            subtype="pdf",
            filename=path.name,
        )

    with smtplib.SMTP(host, port, timeout=30) as server:
        server.starttls()
        server.login(user, password)
        server.send_message(message)


def apply_to_application(application_id):
    application = apply_db.get_application(application_id)

    if not application:
        raise ApplicationNotFoundError(f"Application {application_id} not found")

    if application["status"] == "sent":
        return application

    if not application["apply_email"]:
        apply_db.update_status(
            application_id,
            "manual_required",
            "No recruiter email. Open the job link and apply with the generated cover letter.",
        )
        return apply_db.get_application(application_id)

    max_per_day = _int_env("MAX_APPLICATIONS_PER_DAY", 10)
    if apply_db.count_sent_today() >= max_per_day:
        raise DailyLimitError(f"Daily limit of {max_per_day} applications reached")

    applicant_name = os.getenv("APPLICANT_NAME", "Applicant")
    subject = f"Application for {application['job_title']} - {applicant_name}"

    try:
        send_application_email(
            application["apply_email"],
            subject,
            application["cover_letter"],
            os.getenv("RESUME_PDF_PATH"),
        )
        apply_db.update_status(application_id, "sent", "Application email sent")
    except Exception as error:
        apply_db.update_status(application_id, "failed", str(error)[:480])

    return apply_db.get_application(application_id)
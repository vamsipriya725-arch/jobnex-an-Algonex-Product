# daily_jobs.py
# The daily run: fetch jobs for each keyword, score every job against the saved
# resume (Gemini first, keyword analyzer as a fallback), and store the result
# under today's date. The UI then shows only today's jobs above the threshold.
import json
import logging
import os
import re
import threading
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import daily_db
from analyzer import analyze_resume
from job_fetcher import fetch_jobs, JobFetchError

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

log = logging.getLogger("jobnex.daily")

_RUN_LOCK = threading.Lock()


class DailyRunError(Exception):
    pass


class RunAlreadyActiveError(DailyRunError):
    pass


def _int_env(name, default):
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return int(default)


def timezone_name():
    return os.getenv("DAILY_TIMEZONE", "Asia/Kolkata")


def timezone():
    try:
        return ZoneInfo(timezone_name())
    except Exception:
        return datetime.now().astimezone().tzinfo


def today():
    """Today's date in the configured timezone (not the server's)."""
    return datetime.now(timezone()).date()


def split_keywords(text):
    seen, keywords = set(), []
    for part in re.split(r"[,;\n]+", text or ""):
        word = part.strip()
        if word and word.lower() not in seen:
            seen.add(word.lower())
            keywords.append(word)
    return keywords


# ---------------- scoring ----------------

def _as_text_list(value):
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def normalize_result(data):
    """Make any Gemini JSON answer safe to store: score 0-100, lists of strings."""
    if not isinstance(data, dict):
        raise ValueError("Gemini did not return a JSON object")

    raw_score = data.get("matched_score", data.get("match_score"))
    score = max(0.0, min(100.0, float(raw_score)))

    return {
        "matched_score": round(score, 2),
        "matched_skills": _as_text_list(data.get("matched_skills")),
        "missing_skills": _as_text_list(data.get("missing_skills")),
        "suggestions": _as_text_list(data.get("suggestions")),
        "summary": str(data.get("summary") or "").strip(),
    }


def score_with_gemini(resume_text, jd_text):
    # Imported here so the app still starts when GEMINI_API_KEY is not set.
    from ai_analyzer import analyze_resume_with_ai

    answer = analyze_resume_with_ai(resume_text, jd_text[:6000])
    return normalize_result(json.loads(answer))


def score_job(resume_text, jd_text):
    """Returns (result, scored_by). Falls back to the keyword analyzer."""
    try:
        return score_with_gemini(resume_text, jd_text), "gemini"
    except Exception as error:
        log.warning("Gemini scoring failed (%s); using keyword analyzer", error)
        result = analyze_resume(resume_text, jd_text)
        result["summary"] = ""
        return result, "keyword"


# ---------------- the daily run ----------------

def collect_jobs(keywords, per_keyword):
    """Fetch jobs for every keyword, de-duplicated by (title, company)."""
    found, seen = [], set()

    for keyword in keywords:
        try:
            jobs = fetch_jobs(keyword, per_keyword)
        except (JobFetchError, ValueError) as error:
            log.warning("Could not fetch jobs for %r: %s", keyword, error)
            continue

        for job in jobs:
            key = (job["title"].lower(), job["company"].lower())
            if not job["title"] or not job["company"] or key in seen:
                continue
            seen.add(key)
            found.append((keyword, job))

    return found


def run_daily():
    """Fetch + score + store today's jobs. Safe to call twice: jobs already
    scored today are skipped, so a second run costs no extra Gemini calls."""
    if not _RUN_LOCK.acquire(blocking=False):
        raise RunAlreadyActiveError("A daily run is already in progress")

    try:
        settings = daily_db.get_settings()
        resume_text = settings["resume_text"].strip()
        keywords = split_keywords(settings["keywords"])

        if not resume_text:
            raise DailyRunError("Save your resume in the daily settings first")
        if not keywords:
            raise DailyRunError("Add at least one keyword in the daily settings")

        run_date = today()
        already = daily_db.existing_keys(run_date)
        per_keyword = _int_env("DAILY_JOBS_PER_KEYWORD", 10)
        max_new = _int_env("DAILY_MAX_JOBS", 30)

        fetched = collect_jobs(keywords, per_keyword)
        not_scored_yet = [
            (keyword, job) for keyword, job in fetched
            if (job["title"].lower(), job["company"].lower()) not in already
        ]
        fresh = not_scored_yet[:max_new]

        saved = 0
        for keyword, job in fresh:
            result, scored_by = score_job(resume_text, job["description"])
            daily_db.add_match(run_date, keyword, job, result, scored_by)
            saved += 1

        daily_db.set_last_run_date(run_date)
        daily_db.delete_older_than(
            run_date - timedelta(days=_int_env("DAILY_RETAIN_DAYS", 7))
        )

        return {
            "date": run_date.isoformat(),
            "fetched": len(fetched),
            "new_scored": saved,
            "already_scored": len(fetched) - len(not_scored_yet),
            "over_daily_cap": len(not_scored_yet) - len(fresh),
            "total_today": daily_db.count_matches(run_date),
        }
    finally:
        _RUN_LOCK.release()


def run_daily_safely():
    """What the scheduler calls: a failed run is logged, never raised."""
    try:
        summary = run_daily()
        log.info("Daily run finished: %s", summary)
    except RunAlreadyActiveError:
        log.info("Daily run skipped: another run is active")
    except Exception:
        log.exception("Daily run failed")


def should_catch_up(settings, now):
    """True if the server was off at the run time and today's run never happened."""
    if not settings["enabled"] or not settings["resume_text"].strip():
        return False
    if settings["last_run_date"] == now.date():
        return False
    run_time = now.replace(hour=settings["run_hour"], minute=settings["run_minute"],
                           second=0, microsecond=0)
    return now >= run_time
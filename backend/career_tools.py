"""
career_tools.py
Function calling tools wired to JobNex existing features and datasets.
"""
import logging
import urllib.parse
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def search_jobs(query: str, location: str = "") -> Dict[str, Any]:
    """Search for real job listings in JobNex database or Remotive remote jobs feed.
    
    Args:
        query: Job title, tech stack, or keyword (e.g., 'Python developer', 'React', 'DevOps').
        location: Target city, country, or 'Remote' (e.g., 'India', 'Remote', 'Bengaluru').
    """
    clean_query = (query or "").strip()
    clean_location = (location or "").strip()

    if not clean_query:
        return {"status": "error", "message": "Please specify a job title, skill, or keyword to search."}

    results: List[Dict[str, Any]] = []

    # 1. Search MySQL database if available
    try:
        from chatbot_assistant import search_database_jobs
        db_rows = search_database_jobs(clean_query, limit=5)
        for r in db_rows:
            loc = r.get("location") or "Global / Remote"
            if clean_location and clean_location.lower() not in loc.lower() and "global" not in loc.lower():
                continue
            results.append({
                "title": r.get("job_title", "Position"),
                "company": r.get("company", "Company"),
                "location": loc,
                "url": r.get("job_url", "jobs.html"),
                "skills": r.get("matched_skills", ""),
                "source": "JobNex Verified Database"
            })
    except Exception as e:
        logger.debug("Database job search unavailable: %s", e)

    # 2. Search Remotive API if db had few or no results
    if len(results) < 3:
        try:
            from job_fetcher import fetch_jobs
            remote_jobs = fetch_jobs(clean_query, limit=5)
            for j in remote_jobs:
                loc = j.get("location") or "Remote"
                if clean_location and clean_location.lower() not in loc.lower() and "remote" not in loc.lower():
                    continue
                results.append({
                    "title": j.get("title", "Position"),
                    "company": j.get("company", "Company"),
                    "location": loc,
                    "url": j.get("url", "jobs.html"),
                    "skills": clean_query,
                    "source": "Remotive Remote Jobs"
                })
        except Exception as e:
            logger.debug("External jobs API fetch failed: %s", e)

    if not results:
        return {
            "status": "not_found",
            "message": f"No active job listings found for '{clean_query}'" + (f" in {clean_location}" if clean_location else "") + ". Try broader keywords like 'Python' or 'Frontend'."
        }

    return {
        "status": "success",
        "jobs": results[:5],
        "message": f"Found {len(results[:5])} relevant job listings for '{clean_query}'"
    }


def suggest_courses(skills: List[str]) -> Dict[str, Any]:
    """Suggest curated learning courses and documentation for specific technical skills.
    
    Args:
        skills: List of skill names (e.g., ['Docker', 'SQL', 'Python']).
    """
    if not skills:
        return {"status": "error", "message": "Please provide at least one skill name."}

    clean_skills = [str(s).strip() for s in skills if str(s).strip()][:4]
    try:
        from suggestions_resources import suggest_resources
        data = suggest_resources(clean_skills, max_per_skill=3, use_ai=False)
        suggestions = data.get("suggestions", [])
        if suggestions:
            return {
                "status": "success",
                "suggestions": suggestions,
                "message": f"Found curated learning resources for {', '.join(clean_skills)}."
            }
    except Exception as e:
        logger.warning("Course lookup failed: %s", e)

    return {
        "status": "unavailable",
        "message": f"Learning resources for {', '.join(clean_skills)} are not available yet."
    }


def analyze_resume() -> Dict[str, Any]:
    """Open and guide the user to JobNex Resume & Privacy Analyzer for ATS scoring and skill gap analysis."""
    return {
        "status": "ready",
        "action": "open_resume_analyzer",
        "url": "resume-privacy.html",
        "message": (
            "You can analyze your resume directly on JobNex:\n"
            "1. Navigate to **Resume & Privacy** (`resume-privacy.html`).\n"
            "2. Upload your PDF/DOCX or paste resume text.\n"
            "3. Paste your target Job Description.\n"
            "4. Click **Analyze Compatibility** to view your ATS score, detected skills, and missing requirements."
        )
    }


def start_interview_simulator(role: str) -> Dict[str, Any]:
    """Launch the interactive mock interview simulator for a specific role or tech stack.
    
    Args:
        role: Target job title or domain (e.g., 'Python Developer', 'Data Analyst', 'Frontend Engineer').
    """
    clean_role = (role or "Software Engineer").strip()
    encoded = urllib.parse.quote_plus(clean_role)
    target_url = f"interview-prep.html?role={encoded}"
    return {
        "status": "ready",
        "action": "start_interview_simulator",
        "role": clean_role,
        "url": target_url,
        "message": (
            f"JobNex Interview Simulator is ready for **{clean_role}**!\n"
            f"You can practice high-frequency technical and behavioral questions at `{target_url}` with interactive scoring."
        )
    }


ALL_TOOLS = [search_jobs, suggest_courses, analyze_resume, start_interview_simulator]

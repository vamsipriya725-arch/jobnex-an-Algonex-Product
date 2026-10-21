# job_fetcher.py
# Finds real job listings from the free Remotive API (no API key needed).
# Remotive asks users to fetch sparingly and to link back to the original
# job page, so results are cached for 15 minutes and every job keeps its url.
import html
import re
import time

import requests

REMOTIVE_URL = "https://remotive.com/api/remote-jobs"
CACHE_SECONDS = 900
_CACHE = {}


class JobFetchError(Exception):
    pass


def _strip_html(text):
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def fetch_jobs(keyword, limit=10):
    keyword = (keyword or "").strip()
    if not keyword:
        raise ValueError("keyword is required")

    limit = max(1, min(int(limit), 25))
    cache_key = (keyword.lower(), limit)

    cached = _CACHE.get(cache_key)
    if cached and time.time() - cached[0] < CACHE_SECONDS:
        return cached[1]

    try:
        response = requests.get(
            REMOTIVE_URL,
            params={"search": keyword, "limit": limit},
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as error:
        raise JobFetchError("Could not fetch jobs right now") from error

    jobs = []
    for item in payload.get("jobs", []):
        jobs.append({
            "title": item.get("title", ""),
            "company": item.get("company_name", ""),
            "location": item.get("candidate_required_location", ""),
            "job_type": item.get("job_type", ""),
            "url": item.get("url", ""),
            "description": _strip_html(item.get("description", "")),
        })

    _CACHE[cache_key] = (time.time(), jobs)
    return jobs
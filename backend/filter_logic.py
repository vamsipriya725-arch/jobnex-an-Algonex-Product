import json
import logging
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from database import get_connection
from resume_privacy import redact_text

logger = logging.getLogger(__name__)

# Certification peru -> aa certification ki vere peru lu (aliases).
# Kotha certification add cheyyalante, ikkada oka line add cheyyandi.
CERTIFICATIONS = {
    "aws certification": [
        "aws certified",
        "aws certification",
        "aws solutions architect",
        "aws cloud practitioner",
        "aws developer associate",
    ],
    "azure certification": ["az-900", "az-104", "az-204", "azure fundamentals", "microsoft certified"],
    "google cloud certification": [
        "google cloud certified",
        "gcp certified",
        "professional cloud architect",
        "associate cloud engineer",
    ],
    "pmp": ["pmp", "project management professional"],
    "scrum master": ["certified scrum master", "csm", "psm"],
    "kubernetes certification": ["cka", "ckad", "certified kubernetes administrator"],
    "ccna": ["ccna", "cisco certified network associate"],
    "comptia": ["comptia", "security+", "network+"],
    "oracle certification": ["oracle certified", "ocp"],
    "python certification": ["pcap", "pcep", "python institute"],
    "data analytics certification": [
        "google data analytics",
        "ibm data science",
        "tensorflow developer certificate",
    ],
    "cissp": ["cissp"],
    "ceh": ["ceh", "certified ethical hacker"],
}

# "2 years", "2+ years", "3.5 yrs", "3-5 years" (range lo modati number teesukuntam)
YEARS_RE = re.compile(
    r"""
    (?P<low>\d+(?:\.\d+)?)                       # modati number (2, 3.5)
    \s*\+?                                       # optional "+"
    (?:\s*(?:-|to)\s*(?P<high>\d+(?:\.\d+)?))?   # optional range (3-5, 3 to 5)
    \s*\+?\s*
    (?:years?|yrs?)\b                            # year / years / yr / yrs
    """,
    re.VERBOSE | re.IGNORECASE,
)

# "experience" leda "exp" padam
EXPERIENCE_WORD_RE = re.compile(r"\bexp(?:erience)?\b", re.IGNORECASE)


def has_phrase(text, phrase):
    """Text lo phrase poorthi padam ga unte matrame True. text lowercase lo undali.
    Example: "csm" ni "icsmith" lo match cheyyadu."""
    pattern = r"(?<![a-z0-9])" + re.escape(phrase) + r"(?![a-z0-9])"
    return re.search(pattern, text) is not None


def find_certifications(text):
    """Text lo dorikina certifications peru lu (CERTIFICATIONS keys) list ga istundi."""
    text = text.lower()
    found = []

    for name, aliases in CERTIFICATIONS.items():
        if any(has_phrase(text, alias) for alias in aliases):
            found.append(name)

    return found


def find_year_mentions(text):
    """Text lo "X years ... experience" laanti chotla X values ni list ga istundi.
    "experience" padam daggara unna year numbers matrame teesukuntam,
    anduke "5 years old" laanti vi count avvavu."""
    values = []

    for match in YEARS_RE.finditer(text):
        window = text[max(0, match.start() - 30): match.end() + 40]
        if EXPERIENCE_WORD_RE.search(window):
            values.append(float(match.group("low")))

    return values


def extract_resume_years(text):
    """Resume lo experience years. "fresher" ani unte 0. Emi dorakkapothe None."""
    values = find_year_mentions(text)

    if values:
        return max(values)

    if re.search(r"\bfresher\b", text, re.IGNORECASE):
        return 0.0

    return None


def extract_required_years(jd_text):
    """JD adigina minimum experience years. JD lo emi cheppakapothe None."""
    values = find_year_mentions(jd_text)
    return min(values) if values else None


def check_requirements(resume_text, jd_text):
    """Oka resume ni oka JD tho compare chesi experience and certifications
    requirements meet avthunnayo cheptundi."""
    resume_years = extract_resume_years(resume_text)
    required_years = extract_required_years(jd_text)

    if required_years is None:
        experience_ok = True          # JD adagaledu, kabatti fail kaadu
    elif resume_years is None:
        experience_ok = False         # JD adigindi, resume lo experience teliyaledu
    else:
        experience_ok = resume_years >= required_years

    resume_certs = find_certifications(resume_text)
    required_certs = find_certifications(jd_text)
    missing_certs = [cert for cert in required_certs if cert not in resume_certs]
    certs_ok = len(missing_certs) == 0

    return {
        "experience": {
            "resume_years": resume_years,
            "required_years": required_years,
            "meets": experience_ok,
        },
        "certifications": {
            "resume_certifications": resume_certs,
            "required_certifications": required_certs,
            "missing_certifications": missing_certs,
            "meets": certs_ok,
        },
        "overall_match": experience_ok and certs_ok,
    }


def has_requested_certification(text, name):
    """Filter lo user adigina certification resume lo undo check chestundi.
    `name` list lo unte (example "pmp") danni aliases tho check chestam,
    lekapothe aa text ne direct ga vethukutam."""
    key = name.strip().lower()
    aliases = CERTIFICATIONS.get(key, [key])
    text = text.lower()
    return any(has_phrase(text, alias) for alias in aliases)


def filter_resumes(resumes, min_experience_years=None, required_certifications=None):
    """Resumes list nundi, experience and certification conditions meet ayyevi matrame istundi.
    resumes: [{"id": ..., "resume_text": "..."}, ...]"""
    required_certifications = required_certifications or []
    matched = []

    for item in resumes:
        text = item["resume_text"]
        years = extract_resume_years(text)

        if min_experience_years is not None:
            if years is None or years < min_experience_years:
                continue

        if not all(has_requested_certification(text, name) for name in required_certifications):
            continue

        matched.append(
            {
                "id": item["id"],
                "experience_years": years,
                "certifications": find_certifications(text),
            }
        )

    return matched


# ---------------------------------------------------------------
# API (router). Idi main.py lo include cheyyali:
#   from filter_logic import router as filter_router
#   app.include_router(filter_router)
# Ee feature results ni DB lo save chestundi (filter_checks, filter_runs).
# /check lo resume text ni redact_text tho hide chesi save chestam.
# /filter lo resume text save cheyyam, ids and counts matrame.
# ---------------------------------------------------------------
router = APIRouter(prefix="/api/filters", tags=["filters"])


class CheckRequest(BaseModel):
    resume_text: str = Field(min_length=50)
    jd_text: str = Field(min_length=50)


class ResumeItem(BaseModel):
    id: int | str
    resume_text: str = Field(min_length=1)


class FilterRequest(BaseModel):
    resumes: list[ResumeItem] = Field(min_length=1, max_length=100)
    min_experience_years: float | None = Field(default=None, ge=0)
    required_certifications: list[str] = Field(default_factory=list)


@router.post("/check")
def check_resume(request: CheckRequest):
    """Oka resume JD ki experience and certification requirements meet chestundo cheptundi."""
    result = check_requirements(request.resume_text, request.jd_text)
    safe_resume_text = redact_text(request.resume_text)  # email/phone hide chesi save

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO filter_checks
                (resume_text, jd_text, resume_years, required_years, experience_meets,
                 resume_certifications, required_certifications, missing_certifications,
                 overall_match)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                safe_resume_text,
                request.jd_text,
                result["experience"]["resume_years"],
                result["experience"]["required_years"],
                result["experience"]["meets"],
                json.dumps(result["certifications"]["resume_certifications"]),
                json.dumps(result["certifications"]["required_certifications"]),
                json.dumps(result["certifications"]["missing_certifications"]),
                result["overall_match"],
            ),
        )
        connection.commit()
        check_id = cursor.lastrowid

    except Exception as error:
        if connection is not None and connection.is_connected():
            connection.rollback()
        logger.exception("failed to save filter check")
        raise HTTPException(status_code=500, detail="Failed to save filter check") from error

    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()

    return {"Check_Id": check_id, **result}


@router.post("/filter")
def filter_candidates(request: FilterRequest):
    """Resumes list ni experience (min years) and certifications tho filter chestundi."""
    resumes = [item.model_dump() for item in request.resumes]

    matched = filter_resumes(
        resumes,
        min_experience_years=request.min_experience_years,
        required_certifications=request.required_certifications,
    )

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        # resume text save cheyyam, ids and counts matrame
        cursor.execute(
            """
            INSERT INTO filter_runs
                (min_experience_years, required_certifications, total_checked,
                 matched_count, matched_ids)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                request.min_experience_years,
                json.dumps(request.required_certifications),
                len(resumes),
                len(matched),
                json.dumps([item["id"] for item in matched]),
            ),
        )
        connection.commit()
        run_id = cursor.lastrowid

    except Exception as error:
        if connection is not None and connection.is_connected():
            connection.rollback()
        logger.exception("failed to save filter run")
        raise HTTPException(status_code=500, detail="Failed to save filter run") from error

    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()

    return {
        "Run_Id": run_id,
        "total_checked": len(resumes),
        "matched_count": len(matched),
        "results": matched,
    }
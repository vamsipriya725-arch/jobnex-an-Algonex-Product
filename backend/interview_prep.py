"""Interview Question Preparation feature.

Takes resume text, job description text and/or a role name, works out the
job role, and returns popular interview-question and coding practice links.

- Roles with stored links (e.g. data analyst) get those direct links.
- Any other role gets search links built from the `_template` rows,
  so every role is covered.
- Only the role is logged. Resume / JD text is never saved or logged.
"""
import logging
import re
from typing import Optional
from urllib.parse import quote_plus

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

from database import get_connection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/interview", tags=["interview"])

GENERAL_ROLE = "general"
INTERVIEW_TYPE = "interview"
CODING_TYPE = "coding"
# Rows with this role hold URL templates containing {role}. Not a real role.
TEMPLATE_ROLE = "_template"

ROLE_KEYWORDS = {
    "data analyst": [
        "data analyst", "sql", "excel", "power bi", "tableau", "pandas",
        "data analysis", "statistics", "dashboard", "data visualization",
    ],
    "python developer": [
        "python developer", "python", "django", "flask", "fastapi",
        "rest api", "oop", "backend",
    ],
    "frontend developer": [
        "frontend developer", "react", "vue", "angular", "javascript", "typescript",
        "html", "css", "tailwind", "next.js", "redux",
    ],
    "java developer": [
        "java developer", "java", "spring boot", "hibernate", "maven",
    ],
    "devops engineer": [
        "devops engineer", "docker", "kubernetes", "terraform", "ci/cd",
        "jenkins", "ansible",
    ],
    "cloud architect": [
        "cloud architect", "aws solutions architect", "gcp architect", "azure architect",
    ],
    "machine learning engineer": [
        "machine learning engineer", "deep learning", "pytorch", "tensorflow", "nlp",
    ],
}

# If the exact role name appears (e.g. "data analyst"), it is a strong signal.
ROLE_NAME_BONUS = 3


# ---------- Pure logic (no DB, no FastAPI) ----------

def has_keyword(text: str, keyword: str) -> bool:
    """Return True if `keyword` appears as a whole word/phrase in `text`."""
    pattern = re.compile(
        r"""
        (?<![a-z0-9])      # not preceded by a letter/digit, so 'sql' does not match 'mysql'
        KEYWORD            # the keyword itself (escaped below so '+' or '.' are safe)
        (?![a-z0-9])       # not followed by a letter/digit
        """.replace("KEYWORD", re.escape(keyword)),
        re.VERBOSE,
    )
    return pattern.search(text) is not None


def combine_texts(resume_text: Optional[str], jd_text: Optional[str]) -> str:
    """Join whichever texts were given into one lowercase string."""
    parts = [part for part in (resume_text, jd_text) if part]
    return " ".join(parts).lower()


def detect_role(text: str) -> str:
    """Pick the role whose keywords match the text best.

    Returns GENERAL_ROLE when nothing matches, so the user still gets links.
    """
    best_role = GENERAL_ROLE
    best_score = 0
    for role, keywords in ROLE_KEYWORDS.items():
        score = sum(1 for keyword in keywords if has_keyword(text, keyword))
        if has_keyword(text, role):
            score += ROLE_NAME_BONUS
        if score > best_score:
            best_role = role
            best_score = score
    return best_role


def build_search_links(templates: list, role: str) -> list:
    """Fill {role} in each template URL and keep its difficulty label.

    quote_plus makes the role safe inside a URL (spaces become +, 'c++' stays safe).
    """
    safe_role = quote_plus(role)
    return [
        {
            "site_name": row["site_name"],
            "site_url": row["site_url"].replace("{role}", safe_role),
            "difficulty": row.get("difficulty", "all"),
        }
        for row in templates
    ]


# ---------- Request model ----------

class InterviewRequest(BaseModel):
    resume_text: Optional[str] = Field(default=None, max_length=20000)
    jd_text: Optional[str] = Field(default=None, max_length=20000)
    role: Optional[str] = Field(default=None, max_length=60)

    @field_validator("resume_text", "jd_text")
    @classmethod
    def blank_to_none(cls, value):
        # Treat "   " the same as "not given"
        if value is None or not value.strip():
            return None
        return value.strip()

    @field_validator("role")
    @classmethod
    def clean_role(cls, value):
        if value is None or not value.strip():
            return None
        # Lowercase so "Data Analyst" matches the stored "data analyst"
        cleaned = " ".join(value.lower().split())
        # Underscore-first names are reserved for internal rows like _template
        if cleaned.startswith("_"):
            raise ValueError("Invalid role")
        return cleaned

    @model_validator(mode="after")
    def need_at_least_one(self):
        if self.resume_text is None and self.jd_text is None and self.role is None:
            raise ValueError("Provide role, resume_text or jd_text")
        return self


# Built-in fallback links if database is unavailable
FALLBACK_RESOURCES = {
    "interview": [
        {"site_name": "GeeksforGeeks", "site_url": "https://www.geeksforgeeks.org/?q={role}+interview+questions", "difficulty": "all"},
        {"site_name": "InterviewBit", "site_url": "https://www.interviewbit.com/search/?q={role}", "difficulty": "medium"},
        {"site_name": "LeetCode Discuss", "site_url": "https://leetcode.com/discuss/interview-question?currentPage=1&orderBy=most_relevant&query={role}", "difficulty": "hard"},
    ],
    "coding": [
        {"site_name": "LeetCode", "site_url": "https://leetcode.com/problemset/all/", "difficulty": "all"},
        {"site_name": "HackerRank", "site_url": "https://www.hackerrank.com/domains", "difficulty": "easy"},
    ]
}


def get_links_from_db(role: str, link_type: str = INTERVIEW_TYPE) -> list:
    """Return up to 20 {site_name, site_url, difficulty} rows for the role and link type."""
    connection = None
    cursor = None
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT site_name, site_url, difficulty FROM interview_resources "
            "WHERE role = %s AND link_type = %s ORDER BY Resource_id LIMIT 20",
            (role, link_type),
        )
        return cursor.fetchall()
    except Exception as error:
        if connection is not None and connection.is_connected():
            connection.rollback()
        logger.warning("Database unavailable (%s); using fallback interview templates", error)
        # Use fallback search templates so the API doesn't fail when MySQL is unconfigured
        return build_search_links(FALLBACK_RESOURCES.get(link_type, []), role)
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


# ---------- Endpoint ----------

@router.post("/resources")
def get_interview_resources(request: InterviewRequest):
    # A role typed by the user wins; otherwise detect it from the texts.
    if request.role:
        role = request.role
    else:
        role = detect_role(combine_texts(request.resume_text, request.jd_text))
    logger.info("Interview role: %s", role)  # role only, never the resume text

    links = get_links_from_db(role)

    # Templates are used for every real role, "general" is not a job role.
    templates = get_links_from_db(TEMPLATE_ROLE) if role != GENERAL_ROLE else []
    base_templates = [t for t in templates if t.get("difficulty", "all") == "all"]
    level_templates = [t for t in templates if t.get("difficulty", "all") != "all"]

    # Role has no stored links: build search links so every role is covered.
    if not links and role != GENERAL_ROLE:
        links = build_search_links(base_templates, role)

    # Still nothing (templates missing): use the general links.
    if not links:
        role = GENERAL_ROLE
        links = get_links_from_db(role)
        level_templates = []

    if not links:
        raise HTTPException(status_code=404, detail="No interview links found")

    # Add the easy / medium / hard interview links for this role.
    links = links + build_search_links(level_templates, role)

    # Coding practice links: role-specific if stored, otherwise the general ones.
    coding_links = get_links_from_db(role, CODING_TYPE)
    if not coding_links:
        coding_links = get_links_from_db(GENERAL_ROLE, CODING_TYPE)

    return {"role": role, "resources": links, "coding_resources": coding_links}
"""
JobNex - Specialized Skills Extractor Module
Extracts only technical and professional skills using Gemini AI Studio with Pydantic validation,
strict exclusion filtering of non-skills/generic words, canonical normalization, and offline caching.
"""

import os
import re
import json
import hashlib
import logging
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from pydantic import BaseModel, Field, ValidationError

load_dotenv()
logger = logging.getLogger(__name__)

# In-memory cache: hash(source + text) -> ExtractedSkills dict
_SKILLS_CACHE: Dict[str, Dict[str, Any]] = {}

# ============================================================================
# Pydantic Schemas
# ============================================================================

class RawSkillOutput(BaseModel):
    skills: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)


class ExtractedSkills(BaseModel):
    all_skills: List[str] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    source: str = ""


# ============================================================================
# Strict Stopwords & Non-Skill Exclusions
# ============================================================================

EXCLUDED_WORDS = {
    # Generic filler / prepositions / boilerplate
    "about", "before", "within", "experience", "name", "phone", "email", "location",
    "url", "linkedin", "github", "portfolio", "resume", "cv", "job", "jobs", "terms",
    "apply", "application", "drag", "drop", "file", "browse", "computer", "powered",
    "dover", "kulfi", "algonex", "company", "user", "candidate", "team", "work", "role",
    "years", "year", "month", "months", "plus", "strong", "good", "high", "level",
    "related", "equivalent", "summary", "education", "project", "projects", "contact",
    "info", "details", "profile", "overview", "objective", "responsibilities", "requirements",
    "qualifications", "skills", "tools", "technologies", "certifications", "hobbies",
    "interests", "maximum", "agree", "privacy", "policy", "logo", "copyright", "rights",
    "reserved", "click", "here", "upload", "submit", "status", "date", "dates", "code",
    "review", "interviews", "hiring", "open", "roles", "careers", "portal", "link",
    "address", "city", "state", "country", "remote", "hybrid", "onsite", "full-time",
    "part-time", "contract", "internship", "per", "week", "hour", "hours", "salary",
    "benefits", "equal", "opportunity", "employer", "aidlc", "analyzer",

    # Job titles & seniority words (must NOT appear as skills)
    "associate", "senior", "junior", "lead", "principal", "intern", "director",
    "manager", "vp", "engineer", "developer", "architect", "specialist", "analyst",
    "consultant", "executive", "officer", "founder", "co-founder", "trainee", "apprentice",
    "staff", "head", "chief", "coder", "programmer",

    # Action verbs (often mistaken for skills in resumes)
    "architected", "developed", "engineered", "designed", "built", "created", "spearheaded",
    "managed", "led", "implemented", "optimized", "deployed", "automated", "maintained",
    "reduced", "increased", "improved", "collaborated", "assisted", "analyzed", "programmed",
    "coded", "tested", "debugged", "monitored", "solved", "delivered", "executed",
    "trained", "mentored", "achieved", "participated", "contributed", "supported",

    # Months & date tokens
    "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
    "january", "february", "march", "april", "june", "july", "august", "september",
    "october", "november", "december", "present", "current", "since"
}

# Normalization mapping: variants -> canonical lowercase term
NORMALIZATION_MAP = {
    "apis": "api",
    "restful api": "rest api",
    "restful apis": "rest api",
    "rest apis": "rest api",
    "restful": "rest api",
    "rest": "rest api",
    "ci-cd": "ci/cd",
    "cicd": "ci/cd",
    "ci / cd": "ci/cd",
    "ci\\cd": "ci/cd",
    "continuous integration": "ci/cd",
    "continuous deployment": "ci/cd",
    "continuous integration/continuous deployment": "ci/cd",
    "js": "javascript",
    "ts": "typescript",
    "py": "python",
    "postgres": "postgresql",
    "psql": "postgresql",
    "node": "node.js",
    "nodejs": "node.js",
    "node js": "node.js",
    "reactjs": "react",
    "react js": "react",
    "react.js": "react",
    "nextjs": "next.js",
    "next js": "next.js",
    "vuejs": "vue",
    "vue.js": "vue",
    "angularjs": "angular",
    "angular.js": "angular",
    "expressjs": "express",
    "express.js": "express",
    "golang": "go",
    "k8s": "kubernetes",
    "mongo": "mongodb",
    "tailwind": "tailwind css",
    "tailwindcss": "tailwind css",
    "aws cloud": "aws",
    "amazon web services": "aws",
    "gcp cloud": "gcp",
    "google cloud": "gcp",
    "azure cloud": "azure",
    "microsoft azure": "azure",
    "ml": "machine learning",
    "dl": "deep learning",
    "genai": "generative ai",
    "gen ai": "generative ai",
    "llm": "llms",
    "llms": "llms",
    "large language models": "llms",
    "tdd": "test-driven development",
    "bdd": "behavior-driven development",
}

# Curated Technical Ontology for offline/fallback extraction
TECH_TAXONOMY = {
    # Languages
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust", "php",
    "ruby", "scala", "kotlin", "swift", "dart", "sql", "html", "css", "r", "shell",
    "bash", "powershell", "perl",
    # Frameworks & Libraries
    "react", "angular", "vue", "next.js", "node.js", "express", "fastapi", "django",
    "flask", "spring", "spring boot", "asp.net", ".net", "laravel", "ruby on rails",
    "tailwind css", "bootstrap", "graphql", "redux", "zustand", "jest", "pytest",
    "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch", "keras",
    # Databases & Caching
    "mysql", "postgresql", "mongodb", "redis", "sqlite", "oracle", "mariadb",
    "cassandra", "elasticsearch", "dynamodb", "snowflake", "neo4j",
    # Cloud & DevOps
    "aws", "azure", "gcp", "docker", "kubernetes", "ci/cd", "terraform", "ansible",
    "linux", "git", "github actions", "gitlab", "jenkins", "nginx", "apache",
    # Methodologies, Architecture & Domain
    "rest api", "microservices", "agile", "scrum", "kanban", "devops",
    "machine learning", "deep learning", "generative ai", "llms", "data modeling",
    "system design", "distributed systems", "web development"
}


# ============================================================================
# Normalization Helper
# ============================================================================

def normalize_skill(skill: str) -> Optional[str]:
    """
    Normalizes a skill token:
      1. Converts to lowercase, strips surrounding whitespace/punctuation.
      2. Maps synonyms (e.g. apis -> api, ci-cd -> ci/cd, js -> javascript).
      3. Discards if in the exclusion list, non-alphanumeric noise, or single letter.
    """
    if not skill or not isinstance(skill, str):
        return None

    cleaned = skill.strip().lower()
    # Remove leading/trailing bullet characters, quotes, or colons
    cleaned = re.sub(r"^[\s\-\*•:\",'\(\)\[\]]+|[\s\-\*•:\",'\(\)\[\]]+$", "", cleaned)
    if not cleaned:
        return None

    # Apply synonym mapping
    cleaned = NORMALIZATION_MAP.get(cleaned, cleaned)

    # Discard if excluded or in stopword list
    if cleaned in EXCLUDED_WORDS:
        return None

    # Check words within multi-word skill: if every word is in EXCLUDED_WORDS, drop it
    words = re.findall(r"[a-z0-9\.\+#/]+", cleaned)
    if not words:
        return None
    if all(w in EXCLUDED_WORDS for w in words):
        return None

    # Length guard: single characters are excluded unless valid (e.g. 'r')
    if len(cleaned) < 2 and cleaned not in {"r"}:
        return None

    # Avoid purely numerical strings
    if cleaned.replace(".", "").isdigit():
        return None

    return cleaned


def clean_and_dedupe_skills(raw_skills: List[str], max_limit: int = 40) -> List[str]:
    """Cleans, normalizes, dedupes, and caps a list of skills."""
    result = []
    seen = set()
    for item in raw_skills:
        norm = normalize_skill(item)
        if norm and norm not in seen:
            seen.add(norm)
            result.append(norm)
            if len(result) >= max_limit:
                break
    return result


# ============================================================================
# Offline / Fallback Extraction Engine
# ============================================================================

def _offline_extract_skills(text: str, source: str = "doc") -> ExtractedSkills:
    """
    Deterministic skill extractor that scans text against the curated technical taxonomy.
    Used when offline, testing with mocks, or when Gemini API is rate-limited.
    """
    text_lower = text.lower()
    found_skills = []

    # Sort taxonomy by length descending so multi-word skills like 'spring boot' or 'rest api' match first
    sorted_tax = sorted(TECH_TAXONOMY, key=lambda s: len(s), reverse=True)

    for tech in sorted_tax:
        pattern = r"(?<![a-zA-Z0-9])" + re.escape(tech) + r"(?![a-zA-Z0-9])"
        if re.search(pattern, text_lower):
            norm = normalize_skill(tech)
            if norm and norm not in found_skills:
                found_skills.append(norm)

    # Distribute into categories
    tools_keywords = {"docker", "kubernetes", "git", "ci/cd", "jenkins", "terraform", "ansible", "linux", "nginx"}
    tech_keywords = {"react", "node.js", "express", "fastapi", "django", "flask", "aws", "azure", "gcp", "mysql", "postgresql", "mongodb", "redis"}

    tools = [s for s in found_skills if s in tools_keywords]
    technologies = [s for s in found_skills if s in tech_keywords]
    skills = [s for s in found_skills if s not in tools and s not in technologies]

    return ExtractedSkills(
        all_skills=found_skills[:40],
        skills=skills[:25],
        tools=tools[:15],
        technologies=technologies[:20],
        certifications=[],
        source=source
    )


# ============================================================================
# Gemini AI Studio Skill Extraction
# ============================================================================

# Map normalized skills to display names
DISPLAY_NAME_MAP = {
    "api": "API",
    "ci/cd": "CI/CD",
    "aws": "AWS",
    "gcp": "GCP",
    "azure": "Azure",
    "sql": "SQL",
    "mysql": "MySQL",
    "postgresql": "PostgreSQL",
    "mongodb": "MongoDB",
    "html": "HTML",
    "css": "CSS",
    "rest api": "REST API",
    "graphql": "GraphQL",
    "node.js": "Node.js",
    "react": "React",
    "next.js": "Next.js",
    "vue": "Vue.js",
    "fastapi": "FastAPI",
    "django": "Django",
    "flask": "Flask",
    "docker": "Docker",
    "kubernetes": "Kubernetes",
    "typescript": "TypeScript",
    "javascript": "JavaScript",
    "python": "Python",
    "linux": "Linux",
    "git": "Git",
    "machine learning": "Machine Learning",
    "deep learning": "Deep Learning",
    "generative ai": "Generative AI",
    "llms": "LLMs",
    "agile": "Agile",
    "scrum": "Scrum",
    "kanban": "Kanban",
    "microservices": "Microservices",
    "devops": "DevOps",
    "system design": "System Design",
    "distributed systems": "Distributed Systems",
    "web development": "Web Development",
}


def format_skill_for_display(skill: str) -> str:
    """Returns a clean, professionally capitalized string for UI display."""
    if not skill:
        return ""
    norm = normalize_skill(skill) or skill.lower().strip()
    if norm in DISPLAY_NAME_MAP:
        return DISPLAY_NAME_MAP[norm]
    # If 3 chars or fewer and mostly letters, uppercase (e.g. AWS, GCP, SQL)
    if len(norm) <= 3 and norm.isalpha():
        return norm.upper()
    return norm.title()


# ============================================================================
# Gemini AI Studio Skill Extraction
# ============================================================================

def _call_gemini_skill_extraction(text: str, source: str) -> Optional[RawSkillOutput]:
    """
    Prompts Gemini via google-genai SDK to return strict JSON with skills, tools,
    technologies, and certifications. Retries up to 2 times on bad output.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY not found in environment.")
        return None

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=12000))
    except Exception as e:
        logger.warning("Could not initialize genai.Client: %s", e)
        return None

    source_label = "Job Description" if source == "jd" else "Candidate Resume"
    prompt = f"""You are a specialized technical and professional skills extraction engine.
Extract ONLY genuine technical and professional skills from the following {source_label}.

Return ONLY a valid JSON object matching this schema:
{{
  "skills": ["programming languages, methodologies, engineering domains"],
  "tools": ["developer tools, devops tools, software platforms"],
  "technologies": ["frameworks, libraries, databases, cloud services"],
  "certifications": ["industry certifications"]
}}

CRITICAL RULES:
1. Include ONLY real technical skills (e.g., Python, React, PostgreSQL, Docker, AWS, Kubernetes, REST API, CI/CD, Agile).
2. STRICTLY EXCLUDE:
   - Generic filler words (about, before, within, experience, name, phone, email, location, url, linkedin, github, portfolio, resume, terms, drag, drop, file, computer, jobs, apply, etc.)
   - Job titles and seniority levels (Associate, Senior, Lead, Junior, Intern, Engineer, Developer)
   - Action verbs (Architected, Developed, Engineered, Designed, Built, Spearheaded, Managed)
   - Months and date words (Jan, Feb, Mar, Apr, May, etc.)
   - Company names, section headings, or soft buzzwords.

INPUT TEXT:
<document>
{text[:7000]}
</document>
"""

    models_to_try = [
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-flash-lite-latest",
        "gemini-3.8-flash",
        "gemini-flash-latest",
        "gemini-pro-latest",
    ]

    # Retry up to 2 times (3 total attempts) across available models
    for attempt in range(3):
        for model_name in models_to_try:
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
                    parsed = json.loads(cleaned_json.strip())
                    return RawSkillOutput.model_validate(parsed)
            except (json.JSONDecodeError, ValidationError) as parse_err:
                logger.warning("Gemini JSON validation failed for %s (attempt %d): %s", model_name, attempt + 1, parse_err)
                continue
            except Exception as e:
                # If rate limited (429) or model missing (404), continue to next model
                logger.debug("Gemini model %s error during skill extraction: %s", model_name, e)
                continue

    return None


# ============================================================================
# Public API
# ============================================================================

def extract_skills(text: str, source: str = "jd") -> Dict[str, Any]:
    """
    Extracts, validates, cleans, normalizes, and dedupes technical skills from text.
    Uses Gemini AI with Pydantic validation when available; falls back seamlessly to
    the offline taxonomy engine.
    Results are cached by hash of the input text.
    """
    if not text or not text.strip():
        return ExtractedSkills(source=source).model_dump()

    cleaned_input = text.strip()
    cache_key = f"{source}:{hashlib.sha256(cleaned_input.encode('utf-8')).hexdigest()}"
    if cache_key in _SKILLS_CACHE:
        return _SKILLS_CACHE[cache_key]

    raw_output: Optional[RawSkillOutput] = None

    # Attempt Gemini extraction
    try:
        raw_output = _call_gemini_skill_extraction(cleaned_input, source)
    except Exception as e:
        logger.warning("Gemini skill extraction encountered error: %s", e)

    # If Gemini returned valid output, clean and normalize all categories
    if raw_output:
        skills = clean_and_dedupe_skills(raw_output.skills, max_limit=30)
        tools = clean_and_dedupe_skills(raw_output.tools, max_limit=20)
        technologies = clean_and_dedupe_skills(raw_output.technologies, max_limit=25)
        certifications = clean_and_dedupe_skills(raw_output.certifications, max_limit=10)

        # Merge all distinct normalized skills
        combined = []
        seen = set()
        for s in (technologies + skills + tools + certifications):
            if s not in seen:
                seen.add(s)
                combined.append(s)
                if len(combined) >= 40:
                    break

        extracted = ExtractedSkills(
            all_skills=combined,
            skills=skills,
            tools=tools,
            technologies=technologies,
            certifications=certifications,
            source=source
        )
    else:
        # Fallback to offline deterministic taxonomy engine
        logger.info("Using offline technical skill extraction engine.")
        extracted = _offline_extract_skills(cleaned_input, source)

    result_dict = extracted.model_dump()
    _SKILLS_CACHE[cache_key] = result_dict
    return result_dict


if __name__ == "__main__":
    sample_text = (
        "Senior Full-Stack Engineer with 4 years experience. "
        "Architected scalable microservices using Python, React, and Node.js. "
        "Proficient in Docker containerization, AWS, CI/CD pipelines, and PostgreSQL. "
        "Associated with company in Apr 2023. Contact: url http://linkedin.com/in/vamsi"
    )
    res = extract_skills(sample_text, source="resume")
    print("ALL EXTRACTED SKILLS:", res["all_skills"])
    print("SKILLS:", res["skills"])
    print("TOOLS:", res["tools"])
    print("TECHNOLOGIES:", res["technologies"])

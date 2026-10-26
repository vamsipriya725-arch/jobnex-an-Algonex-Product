import os
import re
import json
import logging
from dotenv import load_dotenv
from google import genai
from google.genai import types

from skills_extractor import (
    extract_skills,
    clean_and_dedupe_skills,
    format_skill_for_display,
)

load_dotenv()
logger = logging.getLogger(__name__)

client = None


def get_client():
    global client
    if client is not None:
        return client
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY was not found in .env")
    client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=12000))
    return client


def dynamic_nlp_analyze(resume_text: str, jd_text: str):
    """
    Dynamically analyzes resume_text against jd_text using skills_extractor.
    Extracts real technical requirements from JD, matches against candidate resume,
    and returns matched_score, matched_skills, missing_skills, and suggestions.
    """
    jd_data = extract_skills(jd_text, source="jd")
    jd_skills = jd_data.get("all_skills", [])

    resume_data = extract_skills(resume_text, source="resume")
    resume_skills = set(resume_data.get("all_skills", []))
    resume_lower = resume_text.lower()

    matched_skills = []
    missing_skills = []

    for skill in jd_skills:
        pattern = r"(?<![a-zA-Z0-9])" + re.escape(skill) + r"(?![a-zA-Z0-9])"
        if skill in resume_skills or re.search(pattern, resume_lower):
            matched_skills.append(skill)
        else:
            missing_skills.append(skill)

    total_reqs = len(jd_skills)
    if total_reqs > 0:
        score = round((len(matched_skills) / total_reqs) * 100, 1)
    else:
        score = 75.0

    suggestions = []
    if missing_skills:
        top_missing = [format_skill_for_display(s) for s in missing_skills[:4]]
        suggestions.append(f"Incorporate direct experience or project achievements demonstrating: {', '.join(top_missing)}.")
    suggestions.append("Quantify accomplishments in recent roles using measurable metrics and percentages.")
    suggestions.append("Tailor bullet points to directly highlight outcomes aligned with key job requirements.")

    matched_display = [format_skill_for_display(s) for s in matched_skills]
    missing_display = [format_skill_for_display(s) for s in missing_skills]

    return {
        "matched_score": score,
        "match_score": score,
        "matched_skills": matched_display[:15],
        "missing_skills": missing_display[:10],
        "suggestions": suggestions,
        "summary": f"Resume matches {len(matched_skills)} of {total_reqs} detected requirements from the provided job description.",
        "source": "skills_engine"
    }


def analyze_resume_with_ai(resume_text, jd_text):
    """
    Analyzes resume against JD using Google Gemini AI Studio with strict skill extraction.
    Falls back gracefully to the skills_extractor dynamic analysis engine when needed.
    """
    prompt = f"""You are an expert technical recruiter and ATS analysis system.

Compare the candidate's actual resume against the target job description.
Extract ONLY genuine technical and professional skills (languages, frameworks, databases, tools, cloud, CI/CD, Agile).
STRICTLY EXCLUDE generic words (about, before, within, name, phone, email, location, url, experience, linkedin, github),
seniority words (Associate, Senior), action verbs (Architected, Developed), and boilerplate text.

Return your response strictly as valid JSON matching this schema:
{{
  "matched_skills": ["real technical skills present in BOTH resume and JD"],
  "missing_skills": ["real technical requirements from the JD missing from the resume"],
  "suggestions": ["2-3 specific recommendations tailored to this candidate and job"],
  "summary": "1-2 sentence assessment of qualification alignment"
}}

Candidate Resume:
<resume>
{resume_text[:6000]}
</resume>

Target Job Description:
<job_description>
{jd_text[:6000]}
</job_description>
"""

    models_to_try = [
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-flash-lite-latest",
        "gemini-3.8-flash",
        "gemini-flash-latest",
        "gemini-pro-latest",
    ]

    try:
        ai_client = get_client()
        for model_name in models_to_try:
            try:
                response = ai_client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config={"response_mime_type": "application/json"}
                )
                if response and response.text:
                    cleaned = response.text.strip()
                    if cleaned.startswith("```json"):
                        cleaned = cleaned[7:]
                    if cleaned.startswith("```"):
                        cleaned = cleaned[3:]
                    if cleaned.endswith("```"):
                        cleaned = cleaned[:-3]
                    parsed = json.loads(cleaned.strip())

                    # Sanitize returned skills to ensure no stop words or non-skills
                    raw_matched = parsed.get("matched_skills", [])
                    raw_missing = parsed.get("missing_skills", [])
                    clean_matched = clean_and_dedupe_skills(raw_matched, max_limit=15)
                    clean_missing = clean_and_dedupe_skills(raw_missing, max_limit=10)

                    # Compute score based strictly on real cleaned skills
                    total_reqs = len(clean_matched) + len(clean_missing)
                    if total_reqs > 0:
                        score = round((len(clean_matched) / total_reqs) * 100, 1)
                    else:
                        score = 75.0

                    matched_display = [format_skill_for_display(s) for s in clean_matched]
                    missing_display = [format_skill_for_display(s) for s in clean_missing]

                    return json.dumps({
                        "matched_score": score,
                        "match_score": score,
                        "matched_skills": matched_display,
                        "missing_skills": missing_display,
                        "suggestions": parsed.get("suggestions", []),
                        "summary": f"Resume matches {len(clean_matched)} of {total_reqs} detected requirements from the provided job description.",
                        "source": "gemini_ai"
                    })
            except Exception as e:
                logger.debug("Gemini model %s call failed: %s", model_name, e)
                continue
    except Exception as e:
        logger.warning("Could not initialize Gemini client: %s", e)

    # Fallback to skills_extractor engine
    logger.info("Using skills_extractor engine on candidate resume and JD.")
    result = dynamic_nlp_analyze(resume_text, jd_text)
    return json.dumps(result)

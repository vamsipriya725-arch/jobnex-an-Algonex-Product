"""
services/email_generator.py — Generates personalized referral email content using Google Gemini.

Falls back to a template-based generator when no API key is configured.
IMPORTANT: Never invents skills, experience, projects, or relationship details.
           Uses ONLY the data provided in the context objects.
"""
import logging
from typing import Optional

from app.core.config import get_settings
from app.models.user import User
from app.models.candidate_profile import CandidateProfile
from app.models.job import Job
from app.models.referral_contact import ReferralContact
from app.services.matching_service import compute_match

logger = logging.getLogger(__name__)

settings = get_settings()


def _build_template_email(
    candidate: User,
    profile: CandidateProfile,
    job: Job,
    contact: ReferralContact,
    matched_skills: list[str],
) -> tuple[str, str]:
    """
    Fallback template-based email generator.
    Returns (subject, body).
    """
    subject = f"Referral Request – {job.title} at {job.company}"

    skills_str = ", ".join(matched_skills[:5]) if matched_skills else "relevant skills"
    exp_str = (
        f"I have {profile.years_experience} year(s) of experience"
        if profile.years_experience
        else "I have experience"
    )
    location_str = (
        f" I am currently based in {profile.location}." if profile.location else ""
    )
    job_url_str = (
        f"\n\nJob Link: {job.job_url}" if job.job_url else ""
    )
    relationship_str = (
        f" I came across your profile and noticed that you are currently at {job.company}."
        if not contact.contact_relationship
        else f" We are connected as {contact.contact_relationship}, and I noticed you are at {job.company}."
    )

    body = f"""Hi {contact.name.split()[0]},

I hope you're doing well.{relationship_str}

I recently came across the {job.title} opportunity at {job.company} and I wanted to reach out.

{exp_str} in {skills_str} and I'm actively exploring opportunities in this space.{location_str}

If you feel my profile is a good fit for this role, would you be comfortable referring me? I would really appreciate your support.{job_url_str}

I've attached my resume for your reference. Please let me know if you need any additional information.

Thank you so much for your time and consideration.

Best regards,
{candidate.full_name}"""

    return subject, body


async def generate_referral_email(
    candidate: User,
    profile: CandidateProfile | None,
    job: Job,
    contact: ReferralContact,
    custom_instructions: Optional[str] = None,
) -> tuple[str, str]:
    """
    Generate (subject, body) for a referral email.

    Tries Gemini API first; falls back to template if no API key or error.
    """
    profile = profile or CandidateProfile(
        user_id=candidate.id,
        skills=[],
        years_experience=None,
        location=None,
        title=None,
        bio=None,
        resume_url=None,
    )

    match = compute_match(
        candidate_skills=profile.skills or [],
        candidate_experience=profile.years_experience,
        job_required_skills=job.required_skills or [],
        job_experience_required=job.experience_required,
    )

    if not settings.GEMINI_API_KEY:
        logger.info("No Gemini API key configured — using template generator")
        return _build_template_email(candidate, profile, job, contact, match.matched_skills)

    return await _generate_with_gemini(
        candidate=candidate,
        profile=profile,
        job=job,
        contact=contact,
        matched_skills=match.matched_skills,
        custom_instructions=custom_instructions,
    )


async def _generate_with_gemini(
    candidate: User,
    profile: CandidateProfile,
    job: Job,
    contact: ReferralContact,
    matched_skills: list[str],
    custom_instructions: Optional[str] = None,
) -> tuple[str, str]:
    """Call Google Gemini to generate a tailored referral email."""
    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")

        skills_list = ", ".join(matched_skills) if matched_skills else "relevant skills"
        exp_text = (
            f"{profile.years_experience} year(s) of experience"
            if profile.years_experience
            else "professional experience"
        )
        job_url_text = job.job_url or "not provided"
        relationship_text = contact.contact_relationship or "professional connection"
        location_text = profile.location or "not specified"
        custom_text = (
            f"\n\nAdditional instructions from the candidate: {custom_instructions}"
            if custom_instructions
            else ""
        )

        prompt = f"""You are helping a job candidate write a professional referral request email.

CANDIDATE INFORMATION (use ONLY this information — do NOT invent anything):
- Full name: {candidate.full_name}
- Current location: {location_text}
- Years of experience: {exp_text}
- Matching skills for this role: {skills_list}
- Profile/bio: {profile.bio or 'not provided'}

JOB INFORMATION:
- Job title: {job.title}
- Company: {job.company}
- Job location: {job.location or 'not specified'}
- Job URL: {job_url_text}

REFERRAL CONTACT INFORMATION:
- Contact name: {contact.name}
- Contact job title at {job.company}: {contact.job_title or 'employee'}
- Relationship to candidate: {relationship_text}
{custom_text}

RULES:
1. Write a short, professional, warm referral request email.
2. Use ONLY the information provided above. Do NOT invent skills, projects, experiences, or relationship details.
3. Do NOT use generic filler phrases like "I am a passionate professional".
4. If relationship is "not provided", simply say you noticed the contact works at the company.
5. Include the job URL if provided.
6. Keep the email concise (150-200 words max for the body).
7. End with "Best regards," followed by the candidate's full name.

Respond with EXACTLY two sections, separated by "---BODY---":
SUBJECT: <the email subject line>
---BODY---
<the full email body starting with "Hi {contact.name.split()[0]}," and ending with the signature>
"""

        response = model.generate_content(prompt)
        text = response.text.strip()

        if "---BODY---" in text:
            parts = text.split("---BODY---", 1)
            subject_line = parts[0].replace("SUBJECT:", "").strip()
            body = parts[1].strip()
        else:
            # Fallback parse: first line is subject
            lines = text.split("\n", 1)
            subject_line = lines[0].replace("SUBJECT:", "").strip()
            body = lines[1].strip() if len(lines) > 1 else text

        logger.info("Gemini generated referral email for user_id=%s job_id=%s", candidate.id, job.id)
        return subject_line, body

    except Exception as exc:
        logger.warning("Gemini generation failed (%s) — falling back to template", exc)
        return _build_template_email(candidate, profile, job, contact, matched_skills)

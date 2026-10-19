"""
services/matching_service.py — Lightweight candidate-job skill matching engine.

Compares candidate skills against job required skills and computes a match score.
Also considers years_of_experience vs experience_required.
"""
from dataclasses import dataclass


@dataclass
class MatchResult:
    match_score: int           # 0-100
    matched_skills: list[str]
    missing_skills: list[str]


def compute_match(
    candidate_skills: list[str],
    candidate_experience: int | None,
    job_required_skills: list[str],
    job_experience_required: int | None,
) -> MatchResult:
    """
    Compute how well a candidate matches a job.

    Algorithm:
    - Skill score (80% weight): (matched_skills / total_required_skills) * 80
    - Experience score (20% weight): full credit if candidate >= required, else 0
    """
    if not job_required_skills:
        # No requirements specified — perfect match
        return MatchResult(match_score=100, matched_skills=[], missing_skills=[])

    candidate_lower = {s.lower() for s in candidate_skills}
    job_lower = [s.lower() for s in job_required_skills]

    matched = [s for s in job_required_skills if s.lower() in candidate_lower]
    missing = [s for s in job_required_skills if s.lower() not in candidate_lower]

    skill_score = round((len(matched) / len(job_required_skills)) * 80)

    # Experience component
    exp_score = 0
    if job_experience_required is None:
        exp_score = 20  # no requirement = full credit
    elif candidate_experience is not None and candidate_experience >= job_experience_required:
        exp_score = 20
    elif candidate_experience is not None and job_experience_required > 0:
        # Partial credit
        exp_score = round((candidate_experience / job_experience_required) * 20)

    final_score = min(100, skill_score + exp_score)

    return MatchResult(
        match_score=final_score,
        matched_skills=matched,
        missing_skills=missing,
    )

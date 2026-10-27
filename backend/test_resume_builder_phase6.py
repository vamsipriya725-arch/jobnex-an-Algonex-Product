"""
Unit tests for JobNex Resume Builder - Phase 6 (ATS Score Tab & Engine)
Tests:
- Deterministic 0–100 rule engine across all 7 criteria
- Content-hash calculation and sensitivity
- Error vs Warning suggestion categorization
- ATS Evaluation endpoint POST /api/resumes/{id}/evaluate-ats
- Surgical AI rewrite endpoint POST /api/resumes/fix-ats with zero-hallucination policy
"""

import pytest
from fastapi.testclient import TestClient
from main import app
from resume_builder import (
    ResumeData,
    PersonalInfo,
    PersonalLink,
    ResumeSection,
    ResumeItem,
    compute_deterministic_ats_score,
    compute_resume_content_hash,
    fallback_ats_fix,
)

client = TestClient(app)


class TestPhase6ATSScoreEngine:
    def test_empty_resume_scoring_and_errors(self):
        """Verifies that an empty or minimal resume scores low with required Error suggestions."""
        empty_resume = ResumeData(
            name="Blank Candidate",
            personal=PersonalInfo(),
            summary="",
            sections=[],
        )
        res = compute_deterministic_ats_score(empty_resume)
        assert res["score"] < 40
        assert res["label"] == "Poor"
        assert "breakdown" in res
        assert res["breakdown"]["contact"]["score"] == 0
        assert res["breakdown"]["core_sections"]["score"] == 0

        # Must flag missing name, email, work section
        rule_ids = {s.ruleId for s in res["suggestions"]}
        assert "rule_contact_name" in rule_ids
        assert "rule_contact_email" in rule_ids
        assert "rule_missing_work" in rule_ids

    def test_optimal_resume_scoring(self):
        """Verifies that a comprehensive resume satisfies ATS benchmarks and achieves Excellent readiness."""
        optimal_resume = ResumeData(
            name="Elena Rostova",
            personal=PersonalInfo(
                name="Elena Rostova",
                email="elena.rostova@example.com",
                phone="+1 (555) 019-2834",
                location="San Francisco, CA",
                links=[PersonalLink(label="LinkedIn", url="https://linkedin.com/in/elenarostova")],
            ),
            summary=(
                "Senior full-stack software engineer with over 8 years of hands-on experience designing and scaling "
                "enterprise cloud platforms, distributed microservices, and high-throughput real-time systems. Proven track "
                "record of accelerating deployment lifecycles, optimizing infrastructure costs, and mentoring cross-functional "
                "engineering squads in Agile environments."
            ),
            sections=[
                ResumeSection(
                    id="sec-work-1",
                    type="work",
                    title="Work Experience",
                    items=[
                        ResumeItem(
                            id="item-work-1",
                            title="Staff Software Engineer",
                            organization="Stripe Inc.",
                            dates="Jan 2021 - Present",
                            location="San Francisco, CA",
                            bullets=[
                                "Architected event-driven payment processing gateway handling 45M daily transactions with 99.999% uptime.",
                                "Spearheaded migration of core monolithic services to Kubernetes, reducing cloud infrastructure spend by 35%.",
                                "Engineered distributed caching layer using Redis and Kafka, cutting p99 checkout latency by 120ms.",
                            ],
                            technologies=["Python", "Go", "Kubernetes", "Kafka", "PostgreSQL"],
                        ),
                        ResumeItem(
                            id="item-work-2",
                            title="Senior Backend Engineer",
                            organization="Dropbox",
                            dates="Jun 2018 - Dec 2020",
                            location="San Francisco, CA",
                            bullets=[
                                "Developed high-throughput metadata synchronization service processing 10 TB of daily file revisions.",
                                "Streamlined CI/CD deployment pipelines, shortening test and build validation times from 40 to 12 minutes.",
                            ],
                            technologies=["Python", "Docker", "AWS", "GraphQL", "Redis"],
                        ),
                    ],
                ),
                ResumeSection(
                    id="sec-edu-1",
                    type="education",
                    title="Education",
                    items=[
                        ResumeItem(
                            id="item-edu-1",
                            title="B.S. in Computer Science",
                            organization="University of California, Berkeley",
                            dates="2014 - 2018",
                            location="Berkeley, CA",
                        )
                    ],
                ),
                ResumeSection(
                    id="sec-skills-1",
                    type="skills",
                    title="Technical Skills",
                    items=[
                        ResumeItem(
                            id="item-skills-1",
                            title="Core Competencies",
                            bullets=["Python, TypeScript, Go, PostgreSQL, Redis, Kubernetes, Docker, AWS, Distributed Systems"],
                        )
                    ],
                ),
            ],
        )

        res = compute_deterministic_ats_score(optimal_resume)
        assert res["score"] >= 85
        assert res["label"] == "Excellent"
        # No error suggestions
        errors = [s for s in res["suggestions"] if s.level == "Error"]
        assert len(errors) == 0

    def test_content_hash_consistency_and_drift(self):
        """Verifies content hash calculation is deterministic and sensitive to text edits."""
        r = ResumeData(
            name="Test Hash",
            personal=PersonalInfo(name="Test Hash", email="test@example.com"),
            summary="A short summary for testing hash calculation.",
        )
        hash1 = compute_resume_content_hash(r)
        hash2 = compute_resume_content_hash(r)
        assert hash1 == hash2

        # Edit summary
        r.summary = "A modified summary for testing hash calculation."
        hash3 = compute_resume_content_hash(r)
        assert hash1 != hash3

    def test_weak_phrase_and_pronoun_detection(self):
        """Verifies detection of weak passive phrases and first-person pronouns."""
        r = ResumeData(
            name="John Doe",
            personal=PersonalInfo(name="John Doe", email="john@example.com", phone="+15551234567"),
            summary="I am an experienced engineer and my goal is to lead great projects.",
            sections=[
                ResumeSection(
                    id="sec-w",
                    type="work",
                    title="Experience",
                    items=[
                        ResumeItem(
                            id="item-w-1",
                            title="Software Engineer",
                            organization="Acme Corp",
                            dates="2020 - 2022",
                            bullets=[
                                "Responsible for managing the team and doing code reviews.",
                                "Helped with fixing bugs in production.",
                            ],
                            technologies=["Python", "SQL", "Git", "Linux", "Docker"],
                        )
                    ],
                ),
                ResumeSection(
                    id="sec-e",
                    type="education",
                    title="Education",
                    items=[ResumeItem(title="BS CS", organization="MIT", dates="2016 - 2020")],
                ),
            ],
        )

        res = compute_deterministic_ats_score(r)
        rule_ids = {s.ruleId for s in res["suggestions"]}
        assert "rule_summary_pronouns" in rule_ids
        assert "rule_weak_phrase" in rule_ids

    def test_chronology_error_detection(self):
        """Verifies that inverted date ranges (start > end) trigger chronology errors."""
        r = ResumeData(
            name="Time Traveler",
            personal=PersonalInfo(name="Time Traveler", email="time@travel.com"),
            sections=[
                ResumeSection(
                    type="work",
                    title="Work Experience",
                    items=[
                        ResumeItem(
                            title="Backend Engineer",
                            organization="Future Corp",
                            dates="2024 - 2021",  # Invalid inverted range
                            bullets=["Spearheaded architecture of quantum database."],
                        )
                    ],
                )
            ],
        )
        res = compute_deterministic_ats_score(r)
        chrono_errors = [s for s in res["suggestions"] if s.ruleId == "rule_chronology"]
        assert len(chrono_errors) > 0
        assert chrono_errors[0].level == "Error"

    def test_evaluate_ats_api_endpoint(self):
        """Verifies POST /api/resumes/{id}/evaluate-ats calculates and stores score."""
        headers = {"X-User-Id": "u-phase6-eval"}
        create_res = client.post(
            "/api/resumes",
            headers=headers,
            json={"name": "ATS Evaluation Target"},
        )
        assert create_res.status_code == 201
        resume_id = create_res.json()["id"]

        eval_res = client.post(f"/api/resumes/{resume_id}/evaluate-ats", headers=headers)
        assert eval_res.status_code == 200
        data = eval_res.json()
        assert data["resume_id"] == resume_id
        assert "readiness_score" in data
        assert "readiness_label" in data
        assert "breakdown" in data
        assert "suggestions" in data

    def test_fix_ats_endpoint_and_fallback_rewriter(self):
        """Verifies surgical rewrite fixes passive phrases without hallucinations."""
        # 1. Test fallback deterministic rewriter directly
        orig = "Responsible for managing a team of 5 engineers and helping with bugs"
        fallback = fallback_ats_fix(orig, "Contains weak passive phrase", "rule_weak_phrase")
        assert "responsible for" not in fallback["suggested_text"].lower()
        assert "helping with" not in fallback["suggested_text"].lower()
        assert "Managed" in fallback["suggested_text"] or "Spearheaded" in fallback["suggested_text"]

        # 2. Test POST /api/resumes/fix-ats endpoint
        fix_res = client.post(
            "/api/resumes/fix-ats",
            headers={"X-User-Id": "u-phase6-eval"},
            json={
                "resume_id": "res-123",
                "rule_id": "rule_weak_phrase",
                "original_text": orig,
                "reason": "Contains weak passive phrase 'responsible for'.",
            },
        )
        assert fix_res.status_code == 200
        fix_data = fix_res.json()
        assert "suggested_text" in fix_data
        assert "explanation" in fix_data
        assert len(fix_data["suggested_text"]) > 10

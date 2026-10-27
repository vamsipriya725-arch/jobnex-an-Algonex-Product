"""
Unit tests for JobNex Resume Builder - Phase 7 (Optimize for Job Tab & Match Engine)
Tests:
- Hard skills, soft skills, and domain term extraction
- Experience timeline and education requirement alignment
- 0-100% match score computation and rubric
- Multiple target jobs persistence, active target job switching, and deletion
- POST /api/resumes/{id}/target-jobs and POST /api/resumes/{id}/analyze-job
- POST /api/resumes/tailor-bullet with zero-hallucination guarantee
- GET /api/resumes/import-jobs endpoint
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
    TargetJob,
    compute_job_match,
    extract_catalog_occurrences,
    extract_years_of_experience,
    extract_candidate_experience_years,
    extract_education_requirement,
    fallback_tailor_bullet,
    HARD_SKILLS_CATALOG,
    SOFT_SKILLS_CATALOG,
    DOMAIN_TERMS_CATALOG,
)

client = TestClient(app)


@pytest.fixture
def sample_resume():
    return ResumeData(
        name="Alex Mercer",
        personal=PersonalInfo(
            name="Alex Mercer",
            email="alex.mercer@example.com",
            phone="+1 (555) 382-9901",
            location="Seattle, WA",
        ),
        summary="Senior Software Engineer with 6+ years of experience building scalable backend microservices, REST APIs, and event-driven data pipelines using Python, Docker, and PostgreSQL.",
        sections=[
            ResumeSection(
                id="sec-work-1",
                type="work",
                title="Work Experience",
                items=[
                    ResumeItem(
                        id="item-w-1",
                        title="Senior Backend Engineer",
                        organization="Amazon Web Services",
                        dates="2021 - Present",
                        bullets=[
                            "Engineered distributed metadata ingestion service processing 50M daily records.",
                            "Architected high-throughput microservices using Python, FastAPI, and Docker on AWS.",
                            "Optimized database query performance with Redis caching layer, reducing p95 latency by 45%.",
                        ],
                        technologies=["Python", "FastAPI", "Docker", "AWS", "Redis", "PostgreSQL"],
                    ),
                    ResumeItem(
                        id="item-w-2",
                        title="Software Engineer",
                        organization="Nordstrom Tech",
                        dates="2018 - 2021",
                        bullets=[
                            "Developed automated CI/CD deployment pipelines using GitLab and Docker.",
                            "Collaborated in Agile sprints with cross-functional product and QA teams.",
                        ],
                        technologies=["Python", "Django", "Git", "Docker", "REST APIs"],
                    ),
                ],
            ),
            ResumeSection(
                id="sec-edu-1",
                type="education",
                title="Education",
                items=[
                    ResumeItem(
                        id="item-e-1",
                        title="Bachelor of Science in Computer Science",
                        organization="University of Washington",
                        dates="2014 - 2018",
                    )
                ],
            ),
            ResumeSection(
                id="sec-skills-1",
                type="skills",
                title="Technical Skills",
                items=[
                    ResumeItem(
                        id="item-s-1",
                        title="Core Technologies",
                        technologies=["Python", "FastAPI", "Docker", "AWS", "PostgreSQL", "Redis", "Git", "REST APIs"],
                    )
                ],
            ),
        ],
    )


class TestPhase7JobMatcher:
    def test_catalog_extraction(self):
        """Verifies accurate detection of hard skills, soft skills, and domain terms with word boundary safety."""
        jd_sample = """
        We are seeking a Senior Full-Stack Engineer with 5+ years of experience in Python, Go, and React.
        Must have hands-on expertise with Kubernetes, Docker, microservices, and CI/CD pipelines.
        Requires strong leadership, cross-functional collaboration, and Bachelor's degree in Computer Science.
        """
        hard = extract_catalog_occurrences(jd_sample, HARD_SKILLS_CATALOG)
        assert "Python" in hard
        assert "Go" in hard
        assert "React" in hard
        assert "Kubernetes" in hard
        assert "Docker" in hard

        # Verify no false positive on single letter/short words
        assert "C#" not in hard
        assert "C++" not in hard

        soft = extract_catalog_occurrences(jd_sample, SOFT_SKILLS_CATALOG)
        assert "Leadership" in soft
        assert "Cross-Functional Collaboration" in soft

        domain = extract_catalog_occurrences(jd_sample, DOMAIN_TERMS_CATALOG)
        assert "Microservices" in domain
        assert "CI/CD" in domain

    def test_experience_and_education_alignment(self, sample_resume):
        """Verifies accurate extraction of required experience years and degree requirements."""
        jd_high_exp = "Requirements: 8+ years of professional software engineering experience. Master's degree preferred."
        assert extract_years_of_experience(jd_high_exp) == 8.0
        assert extract_education_requirement(jd_high_exp) == "Master's Degree"

        jd_std_exp = "Minimum 4-6 years of experience required. Bachelor's degree in STEM."
        assert extract_years_of_experience(jd_std_exp) in (4.0, 6.0)
        assert extract_education_requirement(jd_std_exp) == "Bachelor's Degree"

        # Candidate has 2018-Present (~6+ years)
        cand_years = extract_candidate_experience_years(sample_resume)
        assert cand_years >= 5.0

    def test_compute_job_match_scoring(self, sample_resume):
        """Verifies compute_job_match calculates matched/missing keywords, density, and score."""
        jd_stripe = """
        Position: Senior Backend Engineer
        Company: Stripe
        Description:
        We are looking for a Senior Backend Engineer with 5+ years of experience.
        Core requirements:
        - Deep proficiency in Python, FastAPI, Docker, and AWS.
        - Experience with PostgreSQL and Redis.
        - Knowledge of Kubernetes and Kafka is a strong plus.
        - Strong Agile cross-functional collaboration.
        - Bachelor's degree in CS or equivalent.
        """
        match = compute_job_match(sample_resume, "Senior Backend Engineer", "Stripe", jd_stripe)
        assert isinstance(match, TargetJob)
        assert match.title == "Senior Backend Engineer"
        assert match.company == "Stripe"

        # Matched hard skills should include Python, FastAPI, Docker, AWS, PostgreSQL, Redis
        assert "Python" in match.hard_skills_matched
        assert "Docker" in match.hard_skills_matched
        assert "AWS" in match.hard_skills_matched
        assert "PostgreSQL" in match.hard_skills_matched
        assert "Redis" in match.hard_skills_matched

        # Missing hard skills should flag Kafka and Kubernetes
        assert "Kubernetes" in match.hard_skills_missing
        assert "Kafka" in match.hard_skills_missing

        # Keyword density map
        assert "Python" in match.keyword_density
        assert match.keyword_density["Python"]["jd"] >= 1
        assert match.keyword_density["Python"]["resume"] >= 1

        # Alignment
        assert match.experience_alignment["status"] == "Met"
        assert match.education_alignment["status"] == "Match"

        # High match score (candidate has 6 of 8 required skills, met exp, met edu)
        assert match.match_score >= 70
        assert match.match_label in ("Strong Match", "Moderate Match")

        # Tailoring suggestions generated for missing keywords
        assert len(match.tailoring_suggestions) > 0
        sug_keywords = [s["keyword"] for s in match.tailoring_suggestions]
        assert any(k in ("Kubernetes", "Kafka") for k in sug_keywords)

    def test_target_jobs_crud_api_lifecycle(self):
        """Verifies API endpoints for adding, listing, switching active, and deleting target jobs."""
        headers = {"X-User-Id": "u-phase7-target-jobs"}

        # 1. Create fresh resume
        create_res = client.post(
            "/api/resumes",
            headers=headers,
            json={"name": "Job Optimization Target"},
        )
        assert create_res.status_code == 201
        resume_id = create_res.json()["id"]

        # 2. Add Target Job 1 (Stripe)
        job1_payload = {
            "title": "Backend Architect",
            "company": "Stripe",
            "description": "5+ years experience in Python, Docker, Kubernetes, and AWS microservices.",
        }
        post_job1 = client.post(f"/api/resumes/{resume_id}/target-jobs", headers=headers, json=job1_payload)
        assert post_job1.status_code == 200
        job1_data = post_job1.json()
        job1_id = job1_data["id"]
        assert job1_data["title"] == "Backend Architect"
        assert job1_data["is_active"] is True
        assert "match_score" in job1_data

        # 3. Add Target Job 2 (Netflix)
        job2_payload = {
            "title": "Data Platform Engineer",
            "company": "Netflix",
            "description": "Experience with Java, Kafka, Snowflake, and distributed systems.",
        }
        post_job2 = client.post(f"/api/resumes/{resume_id}/target-jobs", headers=headers, json=job2_payload)
        assert post_job2.status_code == 200
        job2_data = post_job2.json()
        job2_id = job2_data["id"]
        assert job2_data["is_active"] is True

        # 4. List target jobs (should have 2 jobs, Job 2 active)
        list_res = client.get(f"/api/resumes/{resume_id}/target-jobs", headers=headers)
        assert list_res.status_code == 200
        saved_jobs = list_res.json()["target_jobs"]
        assert len(saved_jobs) == 2
        active_jobs = [j for j in saved_jobs if j["is_active"]]
        assert len(active_jobs) == 1
        assert active_jobs[0]["id"] == job2_id

        # 5. Switch active job back to Job 1
        switch_res = client.post(f"/api/resumes/{resume_id}/target-jobs/{job1_id}/active", headers=headers)
        assert switch_res.status_code == 200

        # Verify Job 1 is now active
        list_res2 = client.get(f"/api/resumes/{resume_id}/target-jobs", headers=headers)
        saved_jobs2 = list_res2.json()["target_jobs"]
        j1 = next(j for j in saved_jobs2 if j["id"] == job1_id)
        j2 = next(j for j in saved_jobs2 if j["id"] == job2_id)
        assert j1["is_active"] is True
        assert j2["is_active"] is False

        # 6. Delete Job 2
        del_res = client.delete(f"/api/resumes/{resume_id}/target-jobs/{job2_id}", headers=headers)
        assert del_res.status_code == 200

        # Verify only Job 1 remains
        list_res3 = client.get(f"/api/resumes/{resume_id}/target-jobs", headers=headers)
        remaining = list_res3.json()["target_jobs"]
        assert len(remaining) == 1
        assert remaining[0]["id"] == job1_id

    def test_tailor_bullet_endpoint_and_zero_hallucination(self):
        """Verifies surgical bullet tailoring preserves existing facts and weaves in requested keyword."""
        orig_bullet = "Architected high-throughput payment ingestion service processing 20M transactions."
        res = client.post(
            "/api/resumes/tailor-bullet",
            headers={"X-User-Id": "u-phase7-tailor"},
            json={
                "resume_id": "res-demo",
                "bullet_text": orig_bullet,
                "keyword": "Kubernetes",
                "job_title": "Senior Infrastructure Engineer",
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert "suggested_text" in data
        assert "Kubernetes" in data["suggested_text"]
        assert "20M" in data["suggested_text"]  # Fact preserved!
        assert "explanation" in data

        # Test deterministic fallback rewriter directly
        fallback = fallback_tailor_bullet(orig_bullet, "Docker")
        assert "Docker" in fallback["suggested_text"]
        assert "20M" in fallback["suggested_text"]

    def test_import_jobs_endpoint(self):
        """Verifies GET /api/resumes/import-jobs returns structured jobs for import."""
        res = client.get("/api/resumes/import-jobs", headers={"X-User-Id": "u-phase7-import"})
        assert res.status_code == 200
        data = res.json()
        assert "jobs" in data
        assert len(data["jobs"]) > 0
        job = data["jobs"][0]
        assert "title" in job
        assert "company" in job
        assert "description" in job
        assert len(job["description"]) > 10

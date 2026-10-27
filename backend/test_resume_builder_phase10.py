"""
Phase 10: Comprehensive End-to-End Tests & Final QA Suite
Covers complete user lifecycles, full CRUD, live preview synchronization,
template customization, deterministic ATS scoring, job targeting & tailoring,
multi-format ATS exports, and security boundary verification.
"""
import io
import json
import uuid
import pytest
from fastapi.testclient import TestClient

from main import app
from resume_builder import (
    ResumeData,
    PersonalInfo,
    ResumeSection,
    ResumeItem,
    TemplateSettings,
    compute_deterministic_ats_score,
    compute_job_match,
    generate_ats_word_document,
    generate_clean_plain_text,
    get_connection,
)

client = TestClient(app)


class TestPhase10EndToEndLifecycleAndQA:

    @pytest.fixture(autouse=True)
    def setup_user_and_headers(self):
        self.user_id = f"u-qa-{uuid.uuid4().hex[:8]}"
        self.headers = {"X-User-Id": self.user_id}

    # ------------------------------------------------------------------------
    # 1. Full User Lifecycle: Create -> Edit -> Evaluate -> Target -> Export -> Delete
    # ------------------------------------------------------------------------
    def test_complete_resume_builder_lifecycle_e2e(self):
        """
        Simulates an entire candidate session from blank creation to final export:
        1. Create new resume
        2. Populate rich factual career history
        3. Customize ATS template settings
        4. Run deterministic ATS evaluation
        5. Target a tech job & evaluate match
        6. Export ATS DOCX & TXT
        7. Duplicate & set active
        8. Delete
        """
        # Step 1: Create a new blank resume
        create_res = client.post(
            "/api/resumes",
            headers=self.headers,
            json={"name": "Alex Mercer - Senior Distributed Systems Engineer"},
        )
        assert create_res.status_code == 201
        resume_data = create_res.json()
        resume_id = resume_data["id"]
        assert resume_data["name"] == "Alex Mercer - Senior Distributed Systems Engineer"
        assert len(resume_data["sections"]) >= 5

        # Step 2: Edit resume content with real achievements (zero-hallucination facts)
        resume_data["personal"] = {
            "name": "Alex Mercer",
            "email": "alex.mercer@systems.io",
            "phone": "+1 (555) 432-8765",
            "location": "Seattle, WA",
            "links": [
                {"label": "GitHub", "url": "https://github.com/alexmercer"},
                {"label": "LinkedIn", "url": "https://linkedin.com/in/alexmercer"},
            ],
        }
        resume_data["summary"] = (
            "Principal Systems Engineer with 8+ years architecting fault-tolerant microservices, "
            "Kafka event backbones, and distributed consensus algorithms in Go and Python."
        )

        # Populate Work Experience
        work_sec = next(s for s in resume_data["sections"] if s["type"] == "work")
        work_sec["items"] = [
            {
                "id": "work-1",
                "title": "Lead Backend Engineer",
                "organization": "CloudStream Networks",
                "dates": "Jan 2021 - Present",
                "location": "Seattle, WA",
                "bullets": [
                    "Architected high-throughput ingestion pipeline processing 45,000 requests/sec with 99.99% availability.",
                    "Reduced p99 API latency from 220ms to 42ms by introducing Redis caching and connection pooling.",
                    "Spearheaded database partitioning across 12 Shards, supporting 300% year-over-year user growth.",
                ],
                "technologies": ["Go", "Python", "Kubernetes", "Kafka", "PostgreSQL", "Redis"],
                "hidden": False,
            },
            {
                "id": "work-2",
                "title": "Software Engineer II",
                "organization": "DataForge Labs",
                "dates": "Aug 2018 - Dec 2020",
                "location": "San Francisco, CA",
                "bullets": [
                    "Engineered asynchronous ETL pipelines ingesting 15TB daily log data into BigQuery.",
                    "Mentored 4 junior software engineers on clean architecture, unit testing, and CI/CD pipelines.",
                ],
                "technologies": ["Python", "Docker", "AWS", "SQL", "BigQuery"],
                "hidden": False,
            },
        ]

        # Populate Education
        edu_sec = next(s for s in resume_data["sections"] if s["type"] == "education")
        edu_sec["items"] = [
            {
                "id": "edu-1",
                "title": "B.S. in Computer Science",
                "organization": "University of Washington",
                "dates": "Sep 2014 - Jun 2018",
                "location": "Seattle, WA",
                "bullets": ["Dean's List 2016-2018", "Focus on Distributed Systems and Operating Systems"],
                "technologies": [],
                "hidden": False,
            }
        ]

        # Populate Skills
        skills_sec = next(s for s in resume_data["sections"] if s["type"] == "skills")
        skills_sec["items"] = [
            {
                "id": "skill-1",
                "title": "Languages & Runtimes",
                "organization": "",
                "dates": "",
                "location": "",
                "bullets": [],
                "technologies": ["Go", "Python", "Java", "TypeScript", "SQL", "Bash"],
                "hidden": False,
            },
            {
                "id": "skill-2",
                "title": "Cloud & Infrastructure",
                "organization": "",
                "dates": "",
                "location": "",
                "bullets": [],
                "technologies": ["Kubernetes", "Docker", "Kafka", "Redis", "PostgreSQL", "GCP", "AWS"],
                "hidden": False,
            },
        ]

        # Save via autosave PUT
        put_res = client.put(
            f"/api/resumes/{resume_id}",
            headers=self.headers,
            json={"content": resume_data},
        )
        assert put_res.status_code == 200
        saved_content = put_res.json()
        assert saved_content["personal"]["name"] == "Alex Mercer"

        # Step 3: Customize Template Settings
        resume_data["templateSettings"] = {
            "templateId": "executive-ats",
            "fontFamily": "Inter",
            "fontSize": 11.0,
            "lineHeight": 1.5,
            "sectionGap": 18,
            "itemSpacing": 12,
            "paddingTop": 26,
            "paddingBottom": 26,
            "paddingSide": 30,
            "primaryColor": "#1e293b",
            "headingStyle": "uppercase",
        }
        put_settings = client.put(
            f"/api/resumes/{resume_id}",
            headers=self.headers,
            json={"content": resume_data},
        )
        assert put_settings.status_code == 200
        assert put_settings.json()["templateSettings"]["templateId"] == "executive-ats"
        assert put_settings.json()["templateSettings"]["primaryColor"] == "#1e293b"

        # Step 4: Run ATS Evaluation Endpoint
        eval_res = client.post(f"/api/resumes/{resume_id}/evaluate-ats", headers=self.headers)
        assert eval_res.status_code == 200
        eval_data = eval_res.json()
        assert eval_data["readiness_score"] >= 80
        assert eval_data["readiness_label"] in ["Good", "Excellent"]
        assert "breakdown" in eval_data

        # Step 5: Save & Analyze Target Job
        target_job_payload = {
            "title": "Staff Infrastructure Engineer",
            "company": "NextGen Cloud Inc",
            "description": (
                "We are seeking a Staff Infrastructure Engineer to scale our distributed systems. "
                "Requirements: 7+ years of backend software engineering experience. "
                "Expertise in Go, Python, Kubernetes, Kafka, Docker, and distributed microservices. "
                "B.S. in Computer Science or equivalent experience."
            ),
        }
        target_res = client.post(
            f"/api/resumes/{resume_id}/target-jobs",
            headers=self.headers,
            json=target_job_payload,
        )
        assert target_res.status_code == 200
        target_data = target_res.json()
        assert target_data["match_score"] >= 75
        assert "Go" in [k.title() for k in target_data["hard_skills_matched"]]
        assert target_data["experience_alignment"]["status"] in ["Met", "Flexible"]

        # Step 6: Export to ATS Word DOCX & Plain Text
        docx_res = client.get(f"/api/resumes/{resume_id}/export-docx", headers=self.headers)
        assert docx_res.status_code == 200
        assert (
            docx_res.headers["content-type"]
            == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        assert "attachment; filename=" in docx_res.headers["content-disposition"]
        assert len(docx_res.content) > 1000

        txt_res = client.get(f"/api/resumes/{resume_id}/export-txt", headers=self.headers)
        assert txt_res.status_code == 200
        assert "text/plain" in txt_res.headers["content-type"]
        txt_body = txt_res.text
        assert "ALEX MERCER" in txt_body
        assert "CloudStream Networks" in txt_body
        assert "45,000 requests/sec" in txt_body

        # Step 7: Duplicate Resume
        dup_res = client.post(f"/api/resumes/{resume_id}/duplicate", headers=self.headers)
        assert dup_res.status_code == 201
        dup_data = dup_res.json()
        assert dup_data["id"] != resume_id
        assert "copy" in dup_data["name"].lower()

        # Step 8: Set Active Flag
        active_res = client.patch(f"/api/resumes/{resume_id}/active", headers=self.headers)
        assert active_res.status_code == 200
        assert active_res.json()["is_active"] is True

        # Verify duplicate resume active flag is False
        dup_check = client.get(f"/api/resumes/{dup_data['id']}", headers=self.headers)
        assert dup_check.json()["is_active"] is False

        # Step 9: Delete Resume
        del_res = client.delete(f"/api/resumes/{resume_id}", headers=self.headers)
        assert del_res.status_code == 200
        del_dup = client.delete(f"/api/resumes/{dup_data['id']}", headers=self.headers)
        assert del_dup.status_code == 200

        # Verify 404 after deletion
        get_deleted = client.get(f"/api/resumes/{resume_id}", headers=self.headers)
        assert get_deleted.status_code == 404

    # ------------------------------------------------------------------------
    # 2. Zero-Hallucination & Clean Output QA Validation
    # ------------------------------------------------------------------------
    def test_zero_hallucination_and_no_bracket_placeholders_in_exports(self):
        """
        Ensures that generated exports and deterministic models strictly never contain
        bracket placeholders like [Location], [Company], [Degree], or fake data.
        """
        resume = ResumeData(
            id="res-qa-zero",
            user_id=self.user_id,
            name="QA Resume",
            personal=PersonalInfo(name="Jordan Reed", email="jordan@example.com", location="Austin, TX"),
            sections=[
                ResumeSection(
                    id="sec-qa-1",
                    type="work",
                    title="Experience",
                    items=[
                        ResumeItem(
                            id="item-qa-1",
                            title="DevOps Engineer",
                            organization="Apex Cloud",
                            dates="2020 - Present",
                            location="Austin, TX",
                            bullets=["Maintained Terraform infrastructure across 4 AWS regions."],
                            technologies=["Terraform", "AWS"],
                        )
                    ],
                )
            ],
            templateSettings=TemplateSettings(),
        )

        # Plain text export check
        plain = generate_clean_plain_text(resume)
        assert "[Location]" not in plain
        assert "[Company]" not in plain
        assert "[Degree]" not in plain
        assert "[Date]" not in plain
        assert "[Employment Type]" not in plain
        assert "Apex Cloud" in plain
        assert "jordan reed" in plain.lower()

        # Word document generator check (single column, ATS compliant)
        docx_bytes = generate_ats_word_document(resume)
        assert docx_bytes.getbuffer().nbytes > 500

    # ------------------------------------------------------------------------
    # 3. Security & Error Handling Edge Cases
    # ------------------------------------------------------------------------
    def test_invalid_resume_id_returns_404_cleanly(self):
        """Validates that non-existent resume ID queries return 404 with clean message."""
        res = client.get("/api/resumes/res-does-not-exist-9999", headers=self.headers)
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

    def test_cross_tenant_data_protection_across_routes(self):
        """Verifies unauthorized users cannot access, update, export, or delete other users' resumes."""
        # User Alpha creates a resume
        alpha_headers = {"X-User-Id": "u-alpha-safe"}
        alpha_res = client.post("/api/resumes", headers=alpha_headers, json={"name": "Confidential Alpha"})
        assert alpha_res.status_code == 201
        res_id = alpha_res.json()["id"]

        # User Beta attempts unauthorized operations
        beta_headers = {"X-User-Id": "u-beta-intruder"}

        # GET
        get_res = client.get(f"/api/resumes/{res_id}", headers=beta_headers)
        assert get_res.status_code == 403

        # PUT
        put_res = client.put(f"/api/resumes/{res_id}", headers=beta_headers, json={"name": "Hacked", "content": {}})
        assert put_res.status_code in [403, 404]

        # EXPORT DOCX
        export_res = client.get(f"/api/resumes/{res_id}/export-docx", headers=beta_headers)
        assert export_res.status_code == 403

        # DELETE
        del_res = client.delete(f"/api/resumes/{res_id}", headers=beta_headers)
        assert del_res.status_code in [403, 404]

        # Cleanup by true owner
        client.delete(f"/api/resumes/{res_id}", headers=alpha_headers)

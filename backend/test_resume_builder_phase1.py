"""
Unit tests for Phase 1: Resume Builder Data Model, Per-User Access, & CRUD Endpoints.
"""
import json
import pytest
from fastapi.testclient import TestClient

from main import app
from resume_builder import (
    ResumeData,
    PersonalInfo,
    PersonalLink,
    ResumeSection,
    ResumeItem,
    TemplateSettings,
    calculate_readiness_label,
)

client = TestClient(app)


def test_resume_data_model_defaults():
    """Validates complete ResumeData JSON serialization and required fields."""
    resume = ResumeData(
        id="test-res-1",
        user_id="user-123",
        name="Senior Software Engineer",
        is_active=True,
        readiness_score=78,
        readiness_label="Good",
        personal=PersonalInfo(
            name="Alex Doe",
            email="alex@example.com",
            phone="+1 555-0199",
            location="San Francisco, CA",
            links=[PersonalLink(label="LinkedIn", url="https://linkedin.com/in/alexdoe")],
        ),
        summary="Impact-driven full-stack engineer with 6+ years experience in distributed systems.",
        sections=[
            ResumeSection(
                id="sec-1",
                type="work",
                title="Work Experience",
                items=[
                    ResumeItem(
                        id="item-1",
                        title="Lead Engineer",
                        organization="Acme Corp",
                        dates="2022 - Present",
                        location="Remote",
                        bullets=["Architected real-time streaming pipeline reducing latency by 45%."],
                        technologies=["Python", "FastAPI", "Kafka", "Docker"],
                    )
                ],
            )
        ],
        templateSettings=TemplateSettings(templateId="modern-clean", fontSize=10.5),
        atsSuggestions=[],
        analyses=[],
    )

    data = resume.model_dump()
    assert data["id"] == "test-res-1"
    assert data["personal"]["name"] == "Alex Doe"
    assert data["personal"]["links"][0]["label"] == "LinkedIn"
    assert len(data["sections"]) == 1
    assert data["sections"][0]["items"][0]["technologies"] == ["Python", "FastAPI", "Kafka", "Docker"]
    assert data["templateSettings"]["templateId"] == "modern-clean"


def test_readiness_label_thresholds():
    """Ensures consistent readiness rating across boundaries."""
    assert calculate_readiness_label(0) == "Poor"
    assert calculate_readiness_label(39) == "Poor"
    assert calculate_readiness_label(40) == "Okayish"
    assert calculate_readiness_label(69) == "Okayish"
    assert calculate_readiness_label(70) == "Good"
    assert calculate_readiness_label(84) == "Good"
    assert calculate_readiness_label(85) == "Excellent"
    assert calculate_readiness_label(100) == "Excellent"


def test_crud_lifecycle_per_user_isolation():
    """Tests create, list, get, update, duplicate, and delete with per-user isolation."""
    user_a = "test-user-alpha"
    user_b = "test-user-beta"
    headers_a = {"X-User-Id": user_a}
    headers_b = {"X-User-Id": user_b}

    # 1. User A creates a resume
    create_resp = client.post(
        "/api/resumes",
        headers=headers_a,
        json={"name": "Alpha Principal Resume", "is_active": True},
    )
    assert create_resp.status_code == 201, create_resp.text
    resume_a = create_resp.json()
    resume_id = resume_a["id"]
    assert resume_a["name"] == "Alpha Principal Resume"
    assert resume_a["is_active"] is True
    assert resume_a["user_id"] == user_a

    # 2. User B cannot see User A's resume in list
    list_b = client.get("/api/resumes", headers=headers_b)
    assert list_b.status_code == 200
    b_ids = [r["id"] for r in list_b.json()["resumes"]]
    assert resume_id not in b_ids

    # 3. User B cannot access User A's resume directly (403 forbidden)
    forbidden_resp = client.get(f"/api/resumes/{resume_id}", headers=headers_b)
    assert forbidden_resp.status_code == 403

    # 4. User A can retrieve it
    get_resp = client.get(f"/api/resumes/{resume_id}", headers=headers_a)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == resume_id

    # 5. User A updates resume (autosave simulation)
    update_resp = client.put(
        f"/api/resumes/{resume_id}",
        headers=headers_a,
        json={
            "name": "Alpha Senior Staff Resume",
            "readiness_score": 92,
            "content": {
                **get_resp.json(),
                "name": "Alpha Senior Staff Resume",
                "summary": "Proven tech leader scaling distributed AI infrastructure.",
            },
        },
    )
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert updated_data["name"] == "Alpha Senior Staff Resume"
    assert updated_data["readiness_score"] == 92
    assert updated_data["readiness_label"] == "Excellent"
    assert updated_data["summary"] == "Proven tech leader scaling distributed AI infrastructure."

    # 6. Duplicate resume
    dup_resp = client.post(f"/api/resumes/{resume_id}/duplicate", headers=headers_a)
    assert dup_resp.status_code == 201
    dup_data = dup_resp.json()
    dup_id = dup_data["id"]
    assert dup_id != resume_id
    assert "Copy of" in dup_data["name"]

    # 7. Delete both resumes
    del_resp1 = client.delete(f"/api/resumes/{resume_id}", headers=headers_a)
    assert del_resp1.status_code == 200
    del_resp2 = client.delete(f"/api/resumes/{dup_id}", headers=headers_a)
    assert del_resp2.status_code == 200

    # 8. Verify deletion
    not_found = client.get(f"/api/resumes/{resume_id}", headers=headers_a)
    assert not_found.status_code == 404

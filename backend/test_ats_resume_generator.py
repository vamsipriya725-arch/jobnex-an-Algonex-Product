"""
Unit & Integration Tests for JobNex ATS Resume Generator (backend/ats_resume_generator.py).
Runs offline with mocked Gemini API by default, plus an optional live test when GEMINI_API_KEY is present.
Can be executed via `pytest test_ats_resume_generator.py` or directly via `python test_ats_resume_generator.py`.
"""

import io
import os
import sys
import json
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import docx
from fastapi.testclient import TestClient
from fastapi import FastAPI
from pydantic import ValidationError

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from ats_resume_generator import (
    ResumeData,
    ContactInfo,
    ExperienceItem,
    ProjectItem,
    EducationItem,
    ATSGenerationResult,
    extract_keywords,
    calculate_ats_score,
    extract_text_from_file,
    extract_text_from_docx,
    render_ats_docx,
    generate_ats_resume_data,
    generate_ats_resume,
    router as ats_router,
    _CACHE,
)

# Test FastAPI App with mounted router
app = FastAPI()
app.include_router(ats_router)
client = TestClient(app)


# Sample Mock JSON matching ResumeData schema
SAMPLE_MOCK_JSON = json.dumps({
    "name": "Jane Doe",
    "contact": {
        "email": "jane.doe@example.com",
        "phone": "+1-555-019-2834",
        "location": "San Francisco, CA",
        "linkedin": "linkedin.com/in/janedoe",
        "portfolio": "github.com/janedoe"
    },
    "headline": "Senior Full-Stack Cloud Engineer",
    "summary": "Accomplished Senior Software Engineer with 6+ years specializing in Python, React, and AWS microservices. Proven track record reducing system latency by 40% and deploying scalable distributed architectures.",
    "skills": {
        "Languages": ["Python", "JavaScript", "TypeScript", "SQL"],
        "Frameworks": ["FastAPI", "React", "Django", "Node.js"],
        "Databases": ["PostgreSQL", "Redis", "MySQL"],
        "Cloud & DevOps": ["AWS", "Docker", "Kubernetes", "CI/CD", "Git"]
    },
    "experience": [
        {
            "title": "Lead Software Engineer",
            "company": "Apex Cloud Systems",
            "location": "San Francisco, CA",
            "dates": "March 2021 - Present",
            "bullets": [
                "Architected high-throughput FastAPI microservices processing 2M+ requests daily with 99.99% uptime.",
                "Engineered Redis distributed caching layer reducing database read load by 45%.",
                "Spearheaded containerization strategy utilizing Docker and Kubernetes on AWS EKS."
            ]
        },
        {
            "title": "Full Stack Developer",
            "company": "Nexus Web Solutions",
            "location": "San Jose, CA",
            "dates": "January 2018 - February 2021",
            "bullets": [
                "Built responsive single-page web applications using React and TypeScript.",
                "Designed and implemented RESTful APIs backed by PostgreSQL and Django."
            ]
        }
    ],
    "projects": [
        {
            "name": "Automated ATS Resume Tailor",
            "tools": "Python, FastAPI, Gemini AI, Docker",
            "bullets": [
                "Created an open-source tool analyzing job description keywords and scoring resume alignment."
            ]
        }
    ],
    "education": [
        {
            "degree": "B.S. in Computer Science",
            "institution": "University of California, Berkeley",
            "graduation_year": "2017",
            "honors": "Magna Cum Laude"
        }
    ],
    "certifications": [
        "AWS Certified Solutions Architect - Associate"
    ]
})


# ============================================================================
# 1. Text Extraction & File Support Tests
# ============================================================================

def test_extract_text_from_txt_file():
    sample_content = b"Candidate Name\nExperienced Python and React Developer."
    text = extract_text_from_file(sample_content, "my_resume.txt")
    assert "Candidate Name" in text
    assert "Python and React" in text


def test_extract_text_unsupported_format_raises_error():
    with pytest.raises(ValueError) as exc:
        extract_text_from_file(b"dummy bytes", "resume.xyz")
    assert "Unsupported file format" in str(exc.value)


def test_extract_text_legacy_doc_raises_helpful_error():
    with pytest.raises(ValueError) as exc:
        extract_text_from_file(b"dummy bytes", "resume.doc")
    assert ".docx or .pdf" in str(exc.value)


def test_extract_text_from_docx_stream():
    # Build a tiny in-memory docx
    doc = docx.Document()
    doc.add_paragraph("Alice Wonderland")
    doc.add_paragraph("Full-Stack Engineer with Python and AWS.")
    bio = io.BytesIO()
    doc.save(bio)
    bio.seek(0)

    extracted = extract_text_from_docx(bio)
    assert "Alice Wonderland" in extracted
    assert "Python and AWS" in extracted


# ============================================================================
# 2. ATS Keyword Extraction & Scoring Tests
# ============================================================================

def test_keyword_extraction():
    jd = "Seeking a Senior Python engineer with experience in FastAPI, Docker, and PostgreSQL databases."
    keywords = extract_keywords(jd)
    assert "python" in keywords
    assert "fastapi" in keywords
    assert "docker" in keywords
    assert "postgresql" in keywords


def test_calculate_ats_score():
    resume_text = "Experienced with Python, FastAPI, Docker, Git, and Linux."
    jd_text = "Looking for Python, FastAPI, Docker, Kubernetes, and AWS."

    score, matched, missing = calculate_ats_score(resume_text, jd_text)
    assert score > 0
    assert "python" in matched
    assert "fastapi" in matched
    assert "docker" in matched
    assert "kubernetes" in missing or "aws" in missing


def test_calculate_ats_score_with_resume_data_model():
    data = ResumeData.model_validate_json(SAMPLE_MOCK_JSON)
    jd_text = "Seeking Lead Engineer with Python, React, Redis, AWS, and Docker experience."

    score, matched, missing = calculate_ats_score(data, jd_text)
    assert score >= 80.0
    assert "python" in matched
    assert "react" in matched
    assert "redis" in matched
    assert "docker" in matched


# ============================================================================
# 3. Pydantic Model Validation Tests
# ============================================================================

def test_resume_data_valid_json():
    model = ResumeData.model_validate_json(SAMPLE_MOCK_JSON)
    assert model.name == "Jane Doe"
    assert model.contact.email == "jane.doe@example.com"
    assert len(model.experience) == 2
    assert "Python" in model.skills["Languages"]


def test_resume_data_invalid_structure_raises_validation_error():
    invalid_data = {
        "name": 12345,  # missing contact, headline, etc.
    }
    with pytest.raises(ValidationError):
        ResumeData.model_validate(invalid_data)


# ============================================================================
# 4. ATS-Safe DOCX Rendering Tests
# ============================================================================

def test_render_ats_docx_single_column_no_tables():
    model = ResumeData.model_validate_json(SAMPLE_MOCK_JSON)

    with tempfile.TemporaryDirectory() as tmpdir:
        out_path = Path(tmpdir) / "test_ats_resume.docx"
        rendered_path = render_ats_docx(model, out_path)

        assert Path(rendered_path).exists()
        assert Path(rendered_path).stat().st_size > 0

        # Inspect the generated DOCX structure
        doc = docx.Document(rendered_path)

        # ATS rule: NO tables!
        assert len(doc.tables) == 0, "ATS-safe resume must not use tables"

        # Check section headings are present
        headings_found = set()
        for p in doc.paragraphs:
            text = p.text.strip()
            if text in ["SUMMARY", "SKILLS", "EXPERIENCE", "PROJECTS", "EDUCATION", "CERTIFICATIONS"]:
                headings_found.add(text)

        assert "SUMMARY" in headings_found
        assert "SKILLS" in headings_found
        assert "EXPERIENCE" in headings_found
        assert "EDUCATION" in headings_found


# ============================================================================
# 5. Caching Tests
# ============================================================================

def test_generate_ats_resume_caching():
    _CACHE.clear()
    resume_text = "John Smith\nPython and Django Developer with 3 years experience."
    jd_text = "Looking for a Python and Django developer."

    # Mock Gemini call
    mock_response = MagicMock()
    mock_response.text = SAMPLE_MOCK_JSON
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with tempfile.TemporaryDirectory() as tmpdir:
        res1 = generate_ats_resume(resume_text, jd_text, client=mock_client, output_dir=tmpdir)
        assert res1.from_cache is False

        # Second call with identical input must hit cache
        res2 = generate_ats_resume(resume_text, jd_text, client=mock_client, output_dir=tmpdir)
        assert res2.from_cache is True
        assert res2.ats_score == res1.ats_score
        assert res2.file_id == res1.file_id


# ============================================================================
# 6. Gemini Generation & Retry Logic Tests (Mocked Offline)
# ============================================================================

def test_generate_ats_resume_data_success():
    mock_response = MagicMock()
    mock_response.text = SAMPLE_MOCK_JSON

    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    result = generate_ats_resume_data("My raw resume", "Target job description", client=mock_client)
    assert isinstance(result, ResumeData)
    assert result.name == "Jane Doe"


def test_generate_ats_resume_data_retries_on_invalid_json():
    # First response returns invalid JSON, second response returns valid JSON
    bad_response = MagicMock()
    bad_response.text = "This is not valid json at all {"

    good_response = MagicMock()
    good_response.text = SAMPLE_MOCK_JSON

    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = [bad_response, good_response]

    result = generate_ats_resume_data("My raw resume", "Target job description", client=mock_client, max_retries=2)
    assert isinstance(result, ResumeData)
    assert result.name == "Jane Doe"
    assert mock_client.models.generate_content.call_count == 2


def test_generate_ats_resume_data_fails_on_empty_input():
    with pytest.raises(ValueError):
        generate_ats_resume_data("", "Valid JD")
    with pytest.raises(ValueError):
        generate_ats_resume_data("Valid Resume", "")


# ============================================================================
# 7. FastAPI Router Tests
# ============================================================================

def test_router_health():
    response = client.get("/ats-resume/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "gemini_configured" in data


def test_router_generate_missing_fields_returns_400():
    # Neither resume_text nor resume_file
    res = client.post("/ats-resume/generate", json={"jd_text": "Need python dev"})
    assert res.status_code == 400


@patch("ats_resume_generator.generate_ats_resume")
def test_router_generate_success_with_json_payload(mock_gen):
    mock_result = ATSGenerationResult(
        resume_data=ResumeData.model_validate_json(SAMPLE_MOCK_JSON),
        ats_score=92.5,
        matched_keywords=["python", "fastapi", "docker"],
        missing_keywords=["kubernetes"],
        docx_download_url="/ats-resume/download/ats_test123",
        file_id="ats_test123",
        from_cache=False,
    )
    mock_gen.return_value = mock_result

    payload = {
        "resume_text": "Experienced Python Engineer",
        "jd_text": "Looking for Python and FastAPI"
    }
    response = client.post("/ats-resume/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["ats_score"] == 92.5
    assert "python" in data["matched_keywords"]
    assert data["download_url"] == "/ats-resume/download/ats_test123"


def test_router_download_nonexistent_returns_404():
    response = client.get("/ats-resume/download/non_existent_file_999")
    assert response.status_code == 404


# ============================================================================
# 8. Optional Live Test (runs only if GEMINI_API_KEY is present)
# ============================================================================

@pytest.mark.skipif(
    os.getenv("RUN_LIVE_TEST") != "1" or not os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY") == "your_gemini_api_key_here",
    reason="Live Gemini test is optional. Set RUN_LIVE_TEST=1 in environment with valid GEMINI_API_KEY to run."
)
def test_live_gemini_generation():
    resume = "Alex Rivera. Software Engineer with 3 years Python, FastAPI, and SQL experience at TechCorp."
    jd = "Junior Python Engineer with knowledge of FastAPI, SQL, and Git."

    result = generate_ats_resume(resume, jd)
    assert isinstance(result, ATSGenerationResult)
    assert result.ats_score > 0
    assert result.resume_data.name != ""
    assert result.docx_download_url is not None


# ============================================================================
# Standalone execution
# ============================================================================

if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    print("=" * 60)
    print("[*] Running ATS Resume Generator Test Suite via Pytest...")
    print("=" * 60)
    exit_code = pytest.main(["-v", __file__])
    sys.exit(exit_code)

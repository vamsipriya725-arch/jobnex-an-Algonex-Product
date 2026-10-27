"""
Unit tests for Phase 2: Resume Entry Flow, File Upload Validations,
Job Tracking API, Cancellation, and Zero-Hallucination Fallback.
"""
import io
import pytest
from fastapi.testclient import TestClient

from main import app
from resume_builder import (
    MAX_RESUME_FILE_SIZE_BYTES,
    UPLOAD_JOBS,
    fallback_deterministic_parse,
    compute_baseline_ats_score,
    ResumeData,
)

client = TestClient(app)


def test_upload_file_size_limit_rejection():
    """Validates that files > 2 MB are rejected with HTTP 413."""
    # Generate 2.5 MB fake file
    oversized_bytes = b"0" * (MAX_RESUME_FILE_SIZE_BYTES + 500_000)
    files = {"file": ("large_resume.pdf", io.BytesIO(oversized_bytes), "application/pdf")}
    headers = {"X-User-Id": "test-uploader"}

    resp = client.post("/api/resumes/upload", files=files, headers=headers)
    assert resp.status_code == 413
    assert "exceeds maximum size" in resp.json()["detail"].lower()


def test_upload_invalid_extension_rejection():
    """Validates that unsupported extensions (e.g., .exe, .sh, .png) are rejected with HTTP 422."""
    fake_exe = b"MZ\x90\x00\x03\x00\x00\x00"
    files = {"file": ("malicious_payload.exe", io.BytesIO(fake_exe), "application/octet-stream")}
    headers = {"X-User-Id": "test-uploader"}

    resp = client.post("/api/resumes/upload", files=files, headers=headers)
    assert resp.status_code == 422
    assert "unsupported file format" in resp.json()["detail"].lower()


def test_upload_empty_file_rejection():
    """Validates that empty files are rejected."""
    files = {"file": ("empty_resume.pdf", io.BytesIO(b""), "application/pdf")}
    headers = {"X-User-Id": "test-uploader"}

    resp = client.post("/api/resumes/upload", files=files, headers=headers)
    assert resp.status_code == 422
    assert "empty" in resp.json()["detail"].lower()


def test_valid_upload_job_creation_polling_and_cancel():
    """Validates valid upload job creation, polling /api/jobs/{id}, and cancellation."""
    # Create simple valid dummy PDF byte sequence
    simple_pdf_bytes = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" + (b"A" * 200)
    files = {"file": ("valid_sample_resume.pdf", io.BytesIO(simple_pdf_bytes), "application/pdf")}
    headers = {"X-User-Id": "test-uploader"}

    upload_resp = client.post("/api/resumes/upload", files=files, headers=headers)
    assert upload_resp.status_code == 200
    data = upload_resp.json()
    job_id = data["jobId"]
    assert job_id.startswith("job-")
    assert data["status"] == "processing"

    # Poll status via both routes: /api/jobs/{job_id} and /api/resumes/jobs/{job_id}
    poll_resp1 = client.get(f"/api/jobs/{job_id}")
    assert poll_resp1.status_code == 200
    poll_data1 = poll_resp1.json()
    assert poll_data1["jobId"] == job_id
    assert "stage" in poll_data1
    assert "percent" in poll_data1

    poll_resp2 = client.get(f"/api/resumes/jobs/{job_id}")
    assert poll_resp2.status_code == 200
    assert poll_resp2.json()["jobId"] == job_id

    # Test cancellation endpoint
    cancel_resp = client.post(f"/api/jobs/{job_id}/cancel")
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "cancelled"

    # Polling after cancel shows cancelled
    post_cancel_poll = client.get(f"/api/jobs/{job_id}")
    assert post_cancel_poll.status_code == 200
    assert post_cancel_poll.json()["status"] == "cancelled"


def test_zero_hallucination_fallback_parser():
    """
    Validates that the fallback parser preserves real facts from raw candidate text
    and NEVER inserts fake companies, metrics, or placeholder text.
    """
    raw_sample = """
    Elena Rostova
    elena.rostova@techcorp.io | +1 (415) 890-2345 | linkedin.com/in/elenarostova
    San Francisco, CA

    Professional Summary
    Senior Backend Systems Architect with expertise in distributed microservices, Python, and high-throughput data pipelines.

    Experience
    Senior Backend Engineer | CloudScale Systems
    Jan 2021 - Present
    - Designed and scaled Kubernetes-based stream processing engine handling 50k events/sec.
    - Reduced database query latency by 35% through Redis caching and query indexing.

    Education
    B.S. in Computer Science | UC Berkeley | 2016 - 2020
    """

    parsed = fallback_deterministic_parse(raw_sample, "elena_resume.pdf")

    assert parsed["personal"]["email"] == "elena.rostova@techcorp.io"
    assert parsed["personal"]["phone"] == "+1 (415) 890-2345"
    assert any("linkedin.com" in l["url"] for l in parsed["personal"]["links"])
    assert len(parsed["sections"]) >= 2

    # Check that no placeholder bracket text exists anywhere
    parsed_json_str = str(parsed)
    assert "[Location]" not in parsed_json_str
    assert "[Company]" not in parsed_json_str
    assert "[Employment Type]" not in parsed_json_str
    assert "[Degree]" not in parsed_json_str
    assert "[Date]" not in parsed_json_str

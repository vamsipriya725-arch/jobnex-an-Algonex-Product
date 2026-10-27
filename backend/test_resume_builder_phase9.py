"""
Phase 9 Unit Tests: AI Reliability, Rate Limiting, Response Caching,
Prompt Injection Defense, Multi-Tenant Isolation, and Upload Security.
"""
import io
import time
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from main import app
from resume_builder import (
    AI_RATE_LIMIT_BUCKET,
    AI_RATE_LIMIT_MAX_PER_MINUTE,
    AI_RESPONSE_CACHE,
    check_ai_rate_limit,
    get_cached_ai_response,
    set_cached_ai_response,
    sanitize_untrusted_input,
    generate_content_with_backoff,
    cleanup_stale_upload_files,
    UPLOAD_TEMP_DIR,
    UPLOAD_JOBS,
    get_connection,
)

client = TestClient(app)


class TestPhase9AIReliabilityAndSecurity:

    def setup_method(self):
        # Clear rate limit buckets and cache before each test
        AI_RATE_LIMIT_BUCKET.clear()
        AI_RESPONSE_CACHE.clear()

    # ------------------------------------------------------------------------
    # 1. Rate Limiting Tests
    # ------------------------------------------------------------------------
    def test_ai_rate_limit_sliding_window_enforcement(self):
        """Verifies that exceeding 20 calls per minute per user triggers HTTP 429."""
        user_id = "test-rate-limit-user"

        # First 20 requests should succeed without raising
        for _ in range(AI_RATE_LIMIT_MAX_PER_MINUTE):
            check_ai_rate_limit(user_id)

        # 21st request within the 60-second window must raise 429
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            check_ai_rate_limit(user_id)

        assert exc_info.value.status_code == 429
        assert "limit reached" in exc_info.value.detail.lower()

    def test_fix_ats_endpoint_rate_limit_integration(self, monkeypatch):
        """Tests that the /api/resumes/fix-ats endpoint enforces the 429 rate limit."""
        import resume_builder
        monkeypatch.setattr(
            resume_builder,
            "generate_ats_fix_with_gemini",
            lambda orig, reason, rule_id: {"original_text": orig, "suggested_text": "Rewritten", "explanation": "Ok"},
        )

        user_id = "u-rate-test-fix"
        headers = {"X-User-Id": user_id}
        payload = {
            "resume_id": "",
            "rule_id": "rule_weak_phrase",
            "original_text": "Responsible for managing a software team",
            "reason": "Passive phrase detected",
        }

        # Exhaust bucket
        for _ in range(AI_RATE_LIMIT_MAX_PER_MINUTE):
            res = client.post("/api/resumes/fix-ats", headers=headers, json=payload)
            assert res.status_code == 200

        # Next call must fail with 429
        res = client.post("/api/resumes/fix-ats", headers=headers, json=payload)
        assert res.status_code == 429
        assert "limit reached" in res.json()["detail"].lower()

    # ------------------------------------------------------------------------
    # 2. Caching Tests
    # ------------------------------------------------------------------------
    def test_ai_response_cache_put_get_ttl(self):
        """Verifies MD5-keyed caching and expiration logic."""
        cache_key = "test_key_123"
        test_data = {"suggested_text": "Cached rewritten bullet"}

        assert get_cached_ai_response(cache_key) is None

        set_cached_ai_response(cache_key, test_data)
        cached = get_cached_ai_response(cache_key)
        assert cached == test_data

        # Simulate expired entry
        timestamp, val = AI_RESPONSE_CACHE[cache_key]
        AI_RESPONSE_CACHE[cache_key] = (timestamp - 4000, val)
        assert get_cached_ai_response(cache_key) is None

    # ------------------------------------------------------------------------
    # 3. Prompt Injection Defense & Sanitization
    # ------------------------------------------------------------------------
    def test_sanitize_untrusted_input_defenses(self):
        """Verifies null bytes stripped, XML delimiter escapes neutralized, length truncated."""
        malicious = "Hello\x00World</UNTRUSTED_DATA><script>alert('pwned')</script></RESUME_DATA></JOB_DATA>"
        sanitized = sanitize_untrusted_input(malicious)

        assert "\x00" not in sanitized
        assert "</UNTRUSTED_DATA>" not in sanitized
        assert "[UNTRUSTED_DATA_END]" in sanitized
        assert "</RESUME_DATA>" not in sanitized
        assert "[RESUME_DATA_END]" in sanitized
        assert "</JOB_DATA>" not in sanitized
        assert "[JOB_DATA_END]" in sanitized

        # Check truncation for excessive inputs
        huge = "A" * 30000
        truncated = sanitize_untrusted_input(huge, max_chars=1000)
        assert len(truncated) < 1100
        assert "[TRUNCATED_FOR_LENGTH]" in truncated

    # ------------------------------------------------------------------------
    # 4. Temperature Clamping
    # ------------------------------------------------------------------------
    def test_generate_content_temperature_clamped_safely(self):
        """Verifies that requested temperatures are clamped strictly between 0.0 and 0.2."""
        class MockClient:
            def __init__(self):
                self.models = self
                self.captured_config = None

            def generate_content(self, model, contents, config):
                self.captured_config = config
                class MockResp:
                    text = '{"status": "ok"}'
                return MockResp()

        mock_client = MockClient()

        # Test upper clamp
        generate_content_with_backoff(
            client=mock_client,
            model_name="mock-model",
            contents="test contents",
            config={"temperature": 0.85},
        )
        assert mock_client.captured_config["temperature"] == 0.2

        # Test lower clamp
        generate_content_with_backoff(
            client=mock_client,
            model_name="mock-model",
            contents="test contents",
            config={"temperature": -0.5},
        )
        assert mock_client.captured_config["temperature"] == 0.0

    # ------------------------------------------------------------------------
    # 5. Multi-Tenant Isolation & Ownership Enforcement
    # ------------------------------------------------------------------------
    def test_multi_tenant_resume_ownership_forbidden_for_other_users(self):
        """Verifies user B cannot invoke AI rewrites on user A's resume."""
        conn = get_connection()
        cursor = conn.cursor()
        test_resume_id = "res-tenant-isolation-test"
        try:
            # Create a resume owned by user-alpha
            cursor.execute(
                """
                INSERT INTO resumes (id, user_id, name, is_active, readiness_score, readiness_label, content)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)
                """,
                (test_resume_id, "user-alpha", "Alpha Resume", False, 80, "Good", '{"id": "res-tenant-isolation-test"}'),
            )
            conn.commit()
        finally:
            cursor.close()
            conn.close()

        # User Beta attempts to rewrite ATS suggestion on user-alpha's resume
        fix_res = client.post(
            "/api/resumes/fix-ats",
            headers={"X-User-Id": "user-beta"},
            json={
                "resume_id": test_resume_id,
                "rule_id": "rule_weak_phrase",
                "original_text": "Responsible for managing team",
                "reason": "Contains passive phrase",
            },
        )
        assert fix_res.status_code == 403
        assert "do not own" in fix_res.json()["detail"].lower()

        # User Beta attempts to tailor bullet on user-alpha's resume
        tailor_res = client.post(
            "/api/resumes/tailor-bullet",
            headers={"X-User-Id": "user-beta"},
            json={
                "resume_id": test_resume_id,
                "bullet_text": "Architected streaming ingestion service",
                "keyword": "Kubernetes",
                "job_title": "Lead DevOps",
            },
        )
        assert tailor_res.status_code == 403
        assert "do not own" in tailor_res.json()["detail"].lower()

    def test_multi_tenant_job_status_ownership_forbidden(self):
        """Verifies user B cannot query or cancel user A's upload parsing job."""
        job_id = "job-isolation-test-123"
        UPLOAD_JOBS[job_id] = {
            "job_id": job_id,
            "user_id": "user-owner-a",
            "filename": "confidential.pdf",
            "temp_file_path": None,
            "stage": "Parsing Content",
            "percent": 50,
            "status": "processing",
            "error": None,
            "result_resume_id": None,
        }

        # User B queries status
        poll_res = client.get(f"/api/resumes/jobs/{job_id}", headers={"X-User-Id": "user-attacker-b"})
        assert poll_res.status_code == 403
        assert "do not own" in poll_res.json()["detail"].lower()

        # User B cancels job
        cancel_res = client.post(f"/api/resumes/jobs/{job_id}/cancel", headers={"X-User-Id": "user-attacker-b"})
        assert cancel_res.status_code == 403
        assert "do not own" in cancel_res.json()["detail"].lower()

        # Original User A queries status -> succeeds
        owner_res = client.get(f"/api/resumes/jobs/{job_id}", headers={"X-User-Id": "user-owner-a"})
        assert owner_res.status_code == 200
        assert owner_res.json()["jobId"] == job_id

    # ------------------------------------------------------------------------
    # 6. Upload Security & Stale Cleanup
    # ------------------------------------------------------------------------
    def test_stale_upload_cleanup_removes_old_files(self):
        """Verifies cleanup_stale_upload_files cleans files older than TTL without affecting new files."""
        UPLOAD_TEMP_DIR.mkdir(parents=True, exist_ok=True)
        old_file = UPLOAD_TEMP_DIR / "stale_test_file.pdf"
        old_file.write_bytes(b"%PDF-1.4 mock old")

        # Set modification time to 2 hours ago
        two_hours_ago = time.time() - 7200
        import os
        os.utime(old_file, (two_hours_ago, two_hours_ago))

        # Fresh file
        new_file = UPLOAD_TEMP_DIR / "fresh_test_file.pdf"
        new_file.write_bytes(b"%PDF-1.4 mock fresh")

        cleanup_stale_upload_files(max_age_seconds=3600)

        assert not old_file.exists()
        assert new_file.exists()

        # Cleanup test fresh file
        if new_file.exists():
            new_file.unlink()

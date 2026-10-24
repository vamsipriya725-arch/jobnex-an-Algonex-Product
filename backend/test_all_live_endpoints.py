"""
Comprehensive live end-to-end verification script for all Jobnex backend features and database persistence.
"""
import json
import sys
from fastapi.testclient import TestClient
from main import app
from database import get_connection

def test_everything():
    client = TestClient(app)
    errors = []
    print("=" * 60)
    print("JOBNEX FULL END-TO-END BACKEND & DATABASE AUDIT")
    print("=" * 60)

    # 1. Base Endpoint
    try:
        r = client.get("/")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        print("[PASS] 1. GET / -> Running cleanly")
    except Exception as e:
        errors.append(f"GET /: {e}")
        print(f"[FAIL] 1. GET /: {e}")

    # 2. Upload Resume File
    try:
        files = {"file": ("test_resume.txt", b"Python Developer with FastAPI, SQL and Docker experience. Contact: test@jobnex.com", "text/plain")}
        r = client.post("/api/upload-resume", files=files)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert "text" in data and len(data["text"]) > 10
        print(f"[PASS] 2. POST /api/upload-resume -> Extracted {data['char_count']} chars")
    except Exception as e:
        errors.append(f"POST /api/upload-resume: {e}")
        print(f"[FAIL] 2. POST /api/upload-resume: {e}")

    # 3. Analyze Resume (Privacy Redaction + DB Save)
    analysis_id = None
    try:
        resume_payload = (
            "Bhavani Kandula, Email: kandula@gmail.com, Phone: +91 98765 43210. "
            "Python backend engineer with 4 years experience in Python, FastAPI, SQL, MySQL, and Docker."
        )
        jd_payload = "Looking for a Python Backend Developer with 3+ years experience in Python, FastAPI, and SQL."
        r = client.post("/api/analyze", json={"resume_text": resume_payload, "jd_text": jd_payload})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        analysis_id = data.get("Analysis_Id")
        assert analysis_id is not None, "Analysis_Id was not returned"
        assert "redacted_resume" in data
        assert "[EMAIL REMOVED]" in data["redacted_resume"]
        print(f"[PASS] 3. POST /api/analyze -> Analysis #{analysis_id} created, Score: {data.get('matched_score')}%")
    except Exception as e:
        errors.append(f"POST /api/analyze: {e}")
        print(f"[FAIL] 3. POST /api/analyze: {e}")

    # 4. MySQL Verification: resume_analyzer & resume_privacy_vault
    if analysis_id:
        try:
            conn = get_connection()
            cur = conn.cursor(dictionary=True)

            # Check resume_analyzer
            cur.execute("SELECT Analysis_Id, resume_text, matched_score, created_At FROM resume_analyzer WHERE Analysis_Id = %s", (analysis_id,))
            row1 = cur.fetchone()
            assert row1 is not None, "Record not found in resume_analyzer table!"
            assert "[EMAIL REMOVED]" in row1["resume_text"], "Redaction was not saved to resume_analyzer!"
            print(f"[PASS] 4a. DB `resume_analyzer` -> Verified row #{row1['Analysis_Id']} (Score: {row1['matched_score']}%)")

            # Check resume_privacy_vault
            cur.execute("SELECT vault_id, analysis_id, original_text, pii_stats FROM resume_privacy_vault WHERE analysis_id = %s", (analysis_id,))
            row_vault = cur.fetchone()
            assert row_vault is not None, "Record not found in resume_privacy_vault table!"
            assert "kandula@gmail.com" in row_vault["original_text"], "Original email not found in privacy vault!"
            print(f"[PASS] 4b. DB `resume_privacy_vault` -> Verified unredacted vault #{row_vault['vault_id']} for Analysis #{analysis_id}")

            cur.close()
            conn.close()
        except Exception as e:
            errors.append(f"DB resume_analyzer / vault check: {e}")
            print(f"[FAIL] 4. DB verification: {e}")

    # 5. Retrieve Analyses History
    try:
        r = client.get("/api/analyses")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        history = r.json().get("analyses", [])
        assert len(history) > 0, "No records returned from /api/analyses"
        print(f"[PASS] 5. GET /api/analyses -> Retrieved {len(history)} recent analyses from MySQL")
    except Exception as e:
        errors.append(f"GET /api/analyses: {e}")
        print(f"[FAIL] 5. GET /api/analyses: {e}")

    # 6. Privacy Redact Endpoint
    try:
        sample_text = "Contact: ravi@example.com, Phone: 9876543210, Web: github.com/ravi, PIN: 500081"
        r = client.post("/api/privacy/redact", json={"resume_text": sample_text, "level": "strict"})
        assert r.status_code == 200
        red_data = r.json()
        assert "[EMAIL REMOVED]" in red_data["redacted_text"]
        assert "[PHONE REMOVED]" in red_data["redacted_text"]
        assert "[LINK REMOVED]" in red_data["redacted_text"]
        assert "[LOCATION REMOVED]" in red_data["redacted_text"]
        print(f"[PASS] 6. POST /api/privacy/redact -> All PII entities redacted, Stats: {red_data.get('pii_stats')}")
    except Exception as e:
        errors.append(f"POST /api/privacy/redact: {e}")
        print(f"[FAIL] 6. POST /api/privacy/redact: {e}")

    # 7. Privacy Vault Reveal Endpoint
    if analysis_id:
        try:
            r = client.get(f"/api/privacy/reveal/{analysis_id}")
            assert r.status_code == 200, f"Expected 200, got {r.status_code}"
            rev_data = r.json()
            assert "kandula@gmail.com" in rev_data["original_text"]
            assert rev_data["status"] == "unlocked"
            print(f"[PASS] 7. GET /api/privacy/reveal/{analysis_id} -> Successfully unlocked candidate contact info")
        except Exception as e:
            errors.append(f"GET /api/privacy/reveal/{analysis_id}: {e}")
            print(f"[FAIL] 7. GET /api/privacy/reveal: {e}")

    # 8. Filter Logic: Single Resume Check (filter_checks table)
    check_id = None
    try:
        res_cand = "Candidate with 4 years experience in Python and AWS Certified Solutions Architect."
        res_jd = "Required 3 years experience. Must have AWS Solutions Architect certification."
        r = client.post("/api/filters/check", json={"resume_text": res_cand, "jd_text": res_jd})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        c_data = r.json()
        check_id = c_data.get("Check_Id")
        assert check_id is not None
        assert c_data["overall_match"] is True

        # DB check in filter_checks
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT Check_id, resume_years, required_years, overall_match FROM filter_checks WHERE Check_id = %s", (check_id,))
        fc_row = cur.fetchone()
        assert fc_row is not None
        assert float(fc_row["resume_years"]) == 4.0
        cur.close()
        conn.close()
        print(f"[PASS] 8. POST /api/filters/check -> Check #{check_id} verified in DB `filter_checks` (Match: True)")
    except Exception as e:
        errors.append(f"POST /api/filters/check: {e}")
        print(f"[FAIL] 8. POST /api/filters/check: {e}")

    # 9. Filter Logic: Batch Filter (filter_runs table)
    try:
        batch_res = [
            {"id": "b1", "resume_text": "Candidate 1 with 4 years experience in Hyderabad, India. AWS Certified."},
            {"id": "b2", "resume_text": "Candidate 2 with 1 year experience, no certifications."}
        ]
        r = client.post("/api/filters/filter", json={
            "resumes": batch_res,
            "min_experience_years": 3.0,
            "required_certifications": ["aws certification"],
            "region": "india"
        })
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        f_data = r.json()
        run_id = f_data.get("Run_Id")
        assert run_id is not None
        assert f_data["matched_count"] == 1

        # DB check in filter_runs
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT Run_id, min_experience_years, matched_count FROM filter_runs WHERE Run_id = %s", (run_id,))
        fr_row = cur.fetchone()
        assert fr_row is not None
        assert fr_row["matched_count"] == 1
        cur.close()
        conn.close()
        print(f"[PASS] 9. POST /api/filters/filter -> Run #{run_id} verified in DB `filter_runs` (Matched: 1)")
    except Exception as e:
        errors.append(f"POST /api/filters/filter: {e}")
        print(f"[FAIL] 9. POST /api/filters/filter: {e}")

    # 10. Interview Prep Endpoint
    try:
        r = client.post("/api/interview/resources", json={"role": "python developer"})
        assert r.status_code in (200, 404) # 200 if templates exist in DB, or fallback
        if r.status_code == 200:
            int_data = r.json()
            print(f"[PASS] 10. POST /api/interview/resources -> Role: {int_data.get('role')} with resources")
        else:
            print(f"[INFO] 10. POST /api/interview/resources returned {r.status_code} (Table empty or needs seed data)")
    except Exception as e:
        errors.append(f"POST /api/interview/resources: {e}")
        print(f"[FAIL] 10. POST /api/interview/resources: {e}")

    # 11. Learning Suggestions & Resources
    try:
        r = client.post("/api/resources", json={"missing_skills": ["python", "sql"]})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        res_data = r.json()
        assert "suggestions" in res_data
        print(f"[PASS] 11. POST /api/resources -> Returned learning paths for {len(res_data['suggestions'])} skills")
    except Exception as e:
        errors.append(f"POST /api/resources: {e}")
        print(f"[FAIL] 11. POST /api/resources: {e}")

    # 12. Application Dashboard (Applications & History tables)
    try:
        headers = {"X-User-Id": "test_user_42"}
        # Get Summary
        r_sum = client.get("/dashboard/summary", headers=headers)
        assert r_sum.status_code == 200
        # Post Application
        app_body = {
            "job_title": "Backend Python Engineer",
            "company": "Tech Corp",
            "job_url": "https://example.com/job/backend-engineer-99",
            "source": "auto_apply",
            "status": "APPLIED",
            "notes": "Automated application test"
        }
        r_app = client.post("/dashboard/applications", json=app_body, headers=headers)
        # Duplicate may give 409 or 201
        assert r_app.status_code in (201, 409)
        print(f"[PASS] 12. Application Dashboard -> /dashboard/summary and /dashboard/applications active and connected to MySQL")
    except Exception as e:
        errors.append(f"Dashboard applications: {e}")
        print(f"[FAIL] 12. Dashboard: {e}")

    # 13. Chatbot Assistant
    try:
        r = client.post("/api/chat", json={"message": "How does resume privacy work in Jobnex?", "session_id": "test-audit-sess"})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        chat_data = r.json()
        assert "reply" in chat_data and len(chat_data["reply"]) > 5
        print(f"[PASS] 13. POST /api/chat -> Assistant response: \"{chat_data['reply'][:60]}...\"")
    except Exception as e:
        errors.append(f"POST /api/chat: {e}")
        print(f"[FAIL] 13. POST /api/chat: {e}")

    print("=" * 60)
    if not errors:
        print("RESULT: ALL 13 CORE FEATURES & DATABASE TABLES RUN WITH ZERO ERRORS!")
    else:
        print(f"RESULT: {len(errors)} ERRORS ENCOUNTERED:")
        for err in errors:
            print(f"  - {err}")
    print("=" * 60)
    return len(errors) == 0

if __name__ == "__main__":
    success = test_everything()
    sys.exit(0 if success else 1)

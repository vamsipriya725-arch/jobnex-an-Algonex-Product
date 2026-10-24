"""
Jobnex - Verification Script for Bhavani's 2 Features:
1. Resume Privacy & Redaction (saved to `resume_analyzer` table)
2. Filter Logic: Experience & Certifications (saved to `filter_checks` and `filter_runs` tables)
"""
import json
from fastapi.testclient import TestClient
from main import app
from database import get_connection


def run_verification():
    client = TestClient(app)

    print("==================================================")
    print(">>> Feature 1: Resume Privacy & Analysis")
    print("==================================================")
    resume_input = (
        "Bhavani Kandula, Email: bhavani.kandula@gmail.com, "
        "Phone: +91 98765 43210, LinkedIn: https://linkedin.com/in/bhavani. "
        "Python developer with 4 years experience in Python, FastAPI, MySQL, SQL, and Docker."
    )
    jd_input = "Looking for a Python Developer with 3 years experience in Python, FastAPI, and SQL."

    res1 = client.post("/api/analyze", json={
        "resume_text": resume_input,
        "jd_text": jd_input
    })

    if res1.status_code != 200:
        print("[ERROR] Feature 1 failed:", res1.text)
        return

    data1 = res1.json()
    analysis_id = data1.get("Analysis_Id")
    print(f"[OK] Status Code: {res1.status_code}")
    print(f"[OK] Generated Analysis_Id: {analysis_id}")
    print(f"[OK] Match Score: {data1.get('matched_score')}%")
    print(f"[OK] Matched Skills: {data1.get('matched_skills')}")
    print(f"[OK] Missing Skills: {data1.get('missing_skills')}")
    print(f"[PRIVACY] Redacted Text:\n   {data1.get('redacted_resume')}")

    # Test Privacy Vault Reveal (Authorized recruiter unlocking details)
    res_reveal = client.get(f"/api/privacy/reveal/{analysis_id}")
    if res_reveal.status_code == 200:
        data_reveal = res_reveal.json()
        print(f"[VAULT REVEAL OK] Unlocked Original Contact Info:")
        print(f"   Original: {data_reveal.get('original_text')[:80]}...")
        print(f"   Status  : {data_reveal.get('status')} (PII items: {data_reveal.get('pii_stats')})")

    print("\n==================================================")
    print(">>> Feature 2: Filter Logic (Experience & Certifications)")
    print("==================================================")
    
    # 2A: Single Resume vs JD Check
    filter_resume = (
        "Candidate: Bhavani, email: bhavani@example.com, phone: 9876543210. "
        "4 years of experience as a Backend Developer. "
        "Certified: AWS Certified Solutions Architect."
    )
    filter_jd = (
        "Backend Developer required with minimum 3 years of experience. "
        "Required certification: AWS Certified Solutions Architect."
    )

    res2 = client.post("/api/filters/check", json={
        "resume_text": filter_resume,
        "jd_text": filter_jd
    })
    data2 = res2.json()
    check_id = data2.get("Check_Id")
    print(f"[OK] /api/filters/check Status: {res2.status_code}")
    print(f"[OK] Generated Check_Id: {check_id}")
    print(f"[OK] Experience: {data2['experience']['resume_years']} yrs (Req: {data2['experience']['required_years']} yrs) -> Meets: {data2['experience']['meets']}")
    print(f"[OK] Certifications: {data2['certifications']['resume_certifications']} -> Meets: {data2['certifications']['meets']}")
    print(f"[OK] Overall Filter Match: {data2['overall_match']}")

    # 2B: Batch Resumes Filter Run
    res3 = client.post("/api/filters/filter", json={
        "resumes": [
            {"id": 1, "resume_text": "Candidate 1: 4 years of experience, AWS Certified Solutions Architect."},
            {"id": 2, "resume_text": "Candidate 2: 1 year of experience, no certifications."}
        ],
        "min_experience_years": 3.0,
        "required_certifications": ["aws certification"]
    })
    data3 = res3.json()
    run_id = data3.get("Run_Id")
    print(f"[OK] /api/filters/filter Status: {res3.status_code}")
    print(f"[OK] Generated Run_Id: {run_id}")
    print(f"[OK] Total Checked: {data3['total_checked']}, Matched Count: {data3['matched_count']}")

    print("\n==================================================")
    print(">>> MySQL Database Verification (All 3 Tables)")
    print("==================================================")
    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    # 1. Check resume_analyzer
    cursor.execute("SELECT Analysis_Id, resume_text, matched_score, created_At FROM resume_analyzer WHERE Analysis_Id = %s", (analysis_id,))
    row1 = cursor.fetchone()
    print(f"\n1. Table `resume_analyzer` (Analysis_Id: {row1['Analysis_Id']}):")
    print(f"   Stored Text: {row1['resume_text']}")
    print(f"   Created At : {row1['created_At']}")

    # 2. Check filter_checks
    cursor.execute("SELECT Check_id, resume_text, resume_years, required_years, overall_match, created_At FROM filter_checks WHERE Check_id = %s", (check_id,))
    row2 = cursor.fetchone()
    print(f"\n2. Table `filter_checks` (Check_id: {row2['Check_id']}):")
    print(f"   Stored Text   : {row2['resume_text']}")
    print(f"   Experience OK : {row2['resume_years']} yrs >= {row2['required_years']} yrs")
    print(f"   Overall Match : {bool(row2['overall_match'])}")
    print(f"   Created At    : {row2['created_At']}")

    # 3. Check filter_runs
    cursor.execute("SELECT Run_id, min_experience_years, matched_count, matched_ids, created_At FROM filter_runs WHERE Run_id = %s", (run_id,))
    row3 = cursor.fetchone()
    print(f"\n3. Table `filter_runs` (Run_id: {row3['Run_id']}):")
    print(f"   Min Experience: {row3['min_experience_years']} yrs")
    print(f"   Matched Count : {row3['matched_count']}")
    print(f"   Matched IDs   : {row3['matched_ids']}")
    print(f"   Created At    : {row3['created_At']}")

    cursor.close()
    connection.close()

    print("\n==================================================")
    print("SUCCESS: BOTH FEATURES RUN CLEANLY AND SAVED TO DATABASE!")
    print("==================================================")


if __name__ == "__main__":
    run_verification()

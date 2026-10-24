import urllib.request
import json
from database import get_connection

base_url = "http://127.0.0.1:8000"


def post_json(path, payload):
    req = urllib.request.Request(
        base_url + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))


def main():
    print("==================================================")
    print("1. Testing /api/privacy/redact (Resume Privacy Redact)")
    print("==================================================")
    status, res = post_json("/api/privacy/redact", {
        "resume_text": "Bhavani Kandula, Email: kandulab43@gmail.com, Phone: +91 98765 43210, LinkedIn: https://linkedin.com/in/bhavani"
    })
    print("HTTP Status :", status)
    print("Redacted    :", res["redacted_text"])

    print("\n==================================================")
    print("2. Testing /api/analyze (Privacy Redact + Save to DB)")
    print("==================================================")
    status, res = post_json("/api/analyze", {
        "resume_text": (
            "Bhavani Kandula, Email: kandulab43@gmail.com, Phone: +91 98765 43210, "
            "LinkedIn: https://linkedin.com/in/bhavani. "
            "Python developer with 3 years experience in Python, FastAPI, MySQL, SQL, Docker."
        ),
        "jd_text": "Looking for a Python developer with 3 years experience in Python, SQL and Docker."
    })
    analysis_id = res["Analysis_Id"]
    print("HTTP Status :", status)
    print("Analysis_Id :", analysis_id)
    print("Score       :", res["matched_score"])
    print("Redacted    :", res.get("redacted_resume"))

    print("\n==================================================")
    print("3. Testing /api/filters/check (Filter Logic + Save to DB)")
    print("==================================================")
    status, res = post_json("/api/filters/check", {
        "resume_text": (
            "Candidate: Bhavani, email: kandula@gmail.com, phone: 9876543210. "
            "4 years experience in Python. Certified: AWS Certified Solutions Architect."
        ),
        "jd_text": "Required minimum 3 years experience with AWS Solutions Architect certification."
    })
    check_id = res["Check_Id"]
    print("HTTP Status  :", status)
    print("Check_Id     :", check_id)
    print("Experience OK:", res["experience"]["meets"])
    print("Certs OK     :", res["certifications"]["meets"])
    print("Overall Match:", res["overall_match"])

    print("\n==================================================")
    print("4. Testing /api/filters/filter (Batch Filter + Save to DB)")
    print("==================================================")
    status, res = post_json("/api/filters/filter", {
        "resumes": [
            {"id": 101, "resume_text": "Candidate 1: 4 years of experience, AWS Certified Solutions Architect."},
            {"id": 102, "resume_text": "Candidate 2: 1 year of experience, no certifications."}
        ],
        "min_experience_years": 3.0,
        "required_certifications": ["aws certification"]
    })
    run_id = res["Run_Id"]
    print("HTTP Status  :", status)
    print("Run_Id       :", run_id)
    print("Matched Count:", res["matched_count"])
    print("Matched List :", res["results"])

    print("\n==================================================")
    print("5. Verifying MySQL Database Records")
    print("==================================================")
    conn = get_connection()
    cur = conn.cursor(dictionary=True)

    # 1. resume_analyzer table
    cur.execute("SELECT Analysis_Id, resume_text, matched_score, created_At FROM resume_analyzer WHERE Analysis_Id = %s", (analysis_id,))
    row1 = cur.fetchone()
    print(f"Table resume_analyzer (Row #{row1['Analysis_Id']}):")
    print(f"  Resume Text: {row1['resume_text']}")
    print(f"  Score      : {row1['matched_score']}")
    print(f"  Saved At   : {row1['created_At']}")

    # 2. filter_checks table
    cur.execute("SELECT Check_id, resume_text, resume_years, required_years, overall_match, created_At FROM filter_checks WHERE Check_id = %s", (check_id,))
    row2 = cur.fetchone()
    print(f"\nTable filter_checks (Row #{row2['Check_id']}):")
    print(f"  Resume Text: {row2['resume_text']}")
    print(f"  Years      : {row2['resume_years']} (Req: {row2['required_years']})")
    print(f"  Match      : {bool(row2['overall_match'])}")
    print(f"  Saved At   : {row2['created_At']}")

    # 3. filter_runs table
    cur.execute("SELECT Run_id, min_experience_years, matched_count, matched_ids, created_At FROM filter_runs WHERE Run_id = %s", (run_id,))
    row3 = cur.fetchone()
    print(f"\nTable filter_runs (Row #{row3['Run_id']}):")
    print(f"  Min Years  : {row3['min_experience_years']}")
    print(f"  Matched    : {row3['matched_count']}")
    print(f"  Matched IDs: {row3['matched_ids']}")
    print(f"  Saved At   : {row3['created_At']}")

    cur.close()
    conn.close()

    print("\n==================================================")
    print("SUCCESS: ALL APIS EXECUTED WITH ZERO ERRORS AND SAVED TO DB!")
    print("==================================================")


if __name__ == "__main__":
    main()

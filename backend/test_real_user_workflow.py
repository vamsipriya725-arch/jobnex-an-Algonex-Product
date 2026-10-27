import urllib.request
import json
import time

def run_workflow():
    print("="*60)
    print("1. Testing POST /api/upload-resume (Real text extraction)")
    print("="*60)
    boundary = "----WebKitFormBoundaryXYZ123"
    sample_pdf_text = "Vamsi Priya Tavva\nEmail: vamsi@example.com | Phone: +91 9900000000\nSoftware Engineer proficient in React, Node.js, Express, Python, MySQL, Git, Docker, and REST APIs.\nExperience: Developed full stack web applications and scalable database pipelines."

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="Vamsi_Priya_Resume.txt"\r\n'
        f"Content-Type: text/plain\r\n\r\n"
        f"{sample_pdf_text}\r\n"
        f"--{boundary}--\r\n"
    ).encode("utf-8")

    req1 = urllib.request.Request(
        "http://localhost:3000/api/upload-resume",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )
    res1 = urllib.request.urlopen(req1, timeout=10)
    d1 = json.loads(res1.read().decode())
    print(f"[OK] Uploaded file: {d1.get('filename')}")
    print(f"[OK] Extracted characters: {d1.get('char_count')}")
    print(f"[OK] Extracted Core Skills: {d1.get('core_skills')}")
    extracted_resume = d1.get("text")

    print("\n" + "="*60)
    print("2. Testing POST /api/fetch-jd-url (Fetch JD from Web URL)")
    print("="*60)
    req2 = urllib.request.Request(
        "http://localhost:3000/api/fetch-jd-url",
        data=json.dumps({"url": "https://httpbin.org/html"}).encode(),
        headers={"Content-Type": "application/json"}
    )
    res2 = urllib.request.urlopen(req2, timeout=15)
    d2 = json.loads(res2.read().decode())
    print(f"[OK] Fetched URL: {d2.get('url')}")
    print(f"[OK] Extracted JD preview: {d2.get('jd_text')[:100]}...")

    print("\n" + "="*60)
    print("3. Testing POST /api/analyze (Dynamic Gemini AI & Workbench Storage)")
    print("="*60)
    target_jd = "Senior Full-Stack Engineer.\nRequirements: Must have strong proficiency in React, Node.js, Express, Python, Docker, Kubernetes, GraphQL, and AWS Cloud."
    req3 = urllib.request.Request(
        "http://localhost:3000/api/analyze",
        data=json.dumps({
            "resume_text": extracted_resume,
            "jd_text": target_jd,
            "use_ai": True
        }).encode(),
        headers={"Content-Type": "application/json"}
    )
    t0 = time.time()
    res3 = urllib.request.urlopen(req3, timeout=25)
    d3 = json.loads(res3.read().decode())
    print(f"[OK] Analysis took: {round(time.time()-t0, 2)}s")
    print(f"[OK] Analysis ID in MySQL: #{d3.get('Analysis_Id')}")
    print(f"[OK] Matched Score: {d3.get('matched_score')}%")
    print(f"[OK] Matched Skills: {d3.get('matched_skills')}")
    print(f"[OK] Missing Skills: {d3.get('missing_skills')}")
    print(f"[OK] Suggestions: {d3.get('suggestions')}")

    print("\n" + "="*60)
    print("4. Verifying MySQL Workbench Storage")
    print("="*60)
    import os
    import mysql.connector
    from dotenv import load_dotenv
    load_dotenv()
    conn = mysql.connector.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", "Algonex@2003"),
        database=os.getenv("DB_NAME", "jobnex")
    )
    c = conn.cursor(dictionary=True)
    c.execute("SELECT Analysis_Id, created_At, matched_score, LEFT(resume_text, 60) as r, LEFT(Jd_text, 60) as j, matched_skills, missing_skills FROM resume_analyzer ORDER BY Analysis_Id DESC LIMIT 1")
    latest_row = c.fetchone()
    print(f"[OK] Verified MySQL Workbench Record:")
    print(f"     Analysis_Id: {latest_row['Analysis_Id']}")
    print(f"     Resume Text: {latest_row['r']}...")
    print(f"     JD Text:     {latest_row['j']}...")
    print(f"     Score:       {latest_row['matched_score']}%")
    print(f"     Matched:     {latest_row['matched_skills']}")
    print(f"     Missing:     {latest_row['missing_skills']}")
    print("="*60)


if __name__ == "__main__":
    run_workflow()


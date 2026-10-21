from analyzer import analyze_resume

resume_text = "Python developer with Python, SQL and React skills."
jd_text = "Looking for a Python developer with SQL and FastAPI."

result = analyze_resume(resume_text, jd_text)
print(result)
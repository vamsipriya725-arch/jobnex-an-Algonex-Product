# analyzer.py    
def analyze_resume(resume_text,jd_text):
    
    resume_text=resume_text.lower()
    jd_text=jd_text.lower()
    skills = [
            "python",
            "sql",
            "react",
            "fastapi",
            "docker"
        ]

    matched_skills = []
    missing_skills = []
    suggestions = []

    for i in skills:
        if i in resume_text and i in jd_text:
            matched_skills.append(i)
        else:
            missing_skills.append(i)
            suggestions.append(f"Try learning {i} for this profile add {i} to your resume")

    matched_score = round(len(matched_skills) / len(skills) * 100, 2) if skills else 0.0

    return {
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "suggestions": suggestions,
        "matched_score": matched_score
    }


analyse_resume = analyze_resume
from filter_logic import (
    check_requirements,
    extract_required_years,
    extract_resume_years,
    filter_resumes,
    find_certifications,
    find_year_mentions,
)

# Run cheyyadaniki (backend folder lo nundi):  pytest test_filter_logic.py -v
# Endpoint tests ki "httpx" kavali:  pip install httpx

JD = "Looking for a backend developer with 3+ years of experience in Python. AWS certification and PMP preferred."

RESUMES = [
    {"id": 1, "resume_text": "Python developer with 2 years experience. AWS Certified Cloud Practitioner."},
    {"id": 2, "resume_text": "Python developer with 5 years of experience. PMP certified and Certified Scrum Master."},
    {"id": 3, "resume_text": "Fresher, looking for Python roles. No certifications yet."},
    {"id": "abc", "resume_text": "Backend engineer, 4+ years experience, AWS Certified Solutions Architect, CKA."},
]


# ---------------- Experience ----------------

def test_years_basic():
    assert extract_resume_years("Python developer with 2 years experience in FastAPI") == 2.0


def test_years_plus_and_decimal():
    assert extract_resume_years("4+ years experience in backend") == 4.0
    assert extract_resume_years("Total 3.5 years of experience in Python") == 3.5


def test_resume_takes_highest_value():
    text = "2 years experience in Python and 5 years experience in SQL"
    assert extract_resume_years(text) == 5.0


def test_years_not_near_experience_word_is_ignored():
    # "5 years old" experience kaadu
    assert find_year_mentions("My dog is 5 years old") == []


def test_fresher_is_zero_years():
    assert extract_resume_years("Fresher looking for Python roles") == 0.0


def test_unknown_experience_is_none():
    assert extract_resume_years("Python developer who knows FastAPI and MySQL") is None


def test_required_years_range_takes_lower_value():
    assert extract_required_years("Need 3-5 years of experience in backend development") == 3.0


def test_required_years_none_when_jd_has_no_number():
    assert extract_required_years("Looking for a Python developer to join our team") is None


# ---------------- Certifications ----------------

def test_find_certifications():
    text = "AWS Certified Cloud Practitioner and Certified Scrum Master"
    assert find_certifications(text) == ["aws certification", "scrum master"]


def test_certification_needs_whole_word():
    # "csm" ani "icsmith" lo undi kani poorthi padam kaadu
    assert find_certifications("Worked with Mr icsmith on projects") == []


def test_no_certifications():
    assert find_certifications("Python developer with FastAPI experience") == []


# ---------------- check_requirements ----------------

def test_check_fails_when_experience_and_cert_missing():
    resume = "Python developer with 2 years experience in FastAPI and MySQL. AWS Certified Cloud Practitioner."
    result = check_requirements(resume, JD)

    assert result["experience"] == {"resume_years": 2.0, "required_years": 3.0, "meets": False}
    assert result["certifications"]["missing_certifications"] == ["pmp"]
    assert result["overall_match"] is False


def test_check_passes_when_everything_met():
    resume = "Senior developer with 5 years of experience in Python. PMP certified. AWS Certified Solutions Architect."
    result = check_requirements(resume, JD)

    assert result["experience"]["meets"] is True
    assert result["certifications"]["missing_certifications"] == []
    assert result["overall_match"] is True


def test_check_passes_when_jd_has_no_requirements():
    resume = "Fresher with Python knowledge. Built small projects for practice."
    jd = "We need a junior developer with Python skills for our APIs team."
    result = check_requirements(resume, jd)

    assert result["experience"]["required_years"] is None
    assert result["overall_match"] is True


def test_check_fails_when_resume_experience_unknown():
    resume = "Python developer who knows FastAPI and MySQL databases very well."
    result = check_requirements(resume, JD)

    assert result["experience"]["resume_years"] is None
    assert result["experience"]["meets"] is False


# ---------------- filter_resumes ----------------

def ids(results):
    return [item["id"] for item in results]


def test_filter_by_min_experience():
    assert ids(filter_resumes(RESUMES, min_experience_years=3)) == [2, "abc"]


def test_filter_by_certification():
    assert ids(filter_resumes(RESUMES, required_certifications=["pmp"])) == [2]


def test_filter_by_certification_free_text():
    assert ids(filter_resumes(RESUMES, required_certifications=["CKA"])) == ["abc"]


def test_filter_by_experience_and_certification():
    result = filter_resumes(RESUMES, 3, ["aws certification"])
    assert ids(result) == ["abc"]


def test_filter_without_conditions_returns_all():
    assert len(filter_resumes(RESUMES)) == 4


def test_filter_rejects_unknown_experience_when_min_given():
    resumes = [{"id": 9, "resume_text": "Python developer who knows FastAPI and MySQL."}]
    assert filter_resumes(resumes, min_experience_years=1) == []


def test_filter_result_has_details():
    result = filter_resumes(RESUMES, min_experience_years=5)
    assert result == [{"id": 2, "experience_years": 5.0, "certifications": ["pmp", "scrum master"]}]


# ---------------- Endpoints (TestClient) ----------------

def make_client():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from filter_logic import router

    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_check_endpoint_ok():
    client = make_client()
    body = {
        "resume_text": "Python developer with 2 years experience in FastAPI and MySQL. AWS Certified Cloud Practitioner.",
        "jd_text": JD,
    }

    response = client.post("/api/filters/check", json=body)

    assert response.status_code == 200
    data = response.json()
    assert data["overall_match"] is False
    assert data["certifications"]["missing_certifications"] == ["pmp"]


def test_check_endpoint_short_text_gives_422():
    client = make_client()
    response = client.post("/api/filters/check", json={"resume_text": "Python", "jd_text": "Need Python"})
    assert response.status_code == 422


def test_filter_endpoint_ok():
    client = make_client()
    body = {"resumes": RESUMES, "min_experience_years": 3}

    response = client.post("/api/filters/filter", json=body)

    assert response.status_code == 200
    data = response.json()
    assert data["total_checked"] == 4
    assert data["matched_count"] == 2
    assert [item["id"] for item in data["results"]] == [2, "abc"]


def test_filter_endpoint_negative_experience_gives_422():
    client = make_client()
    body = {"resumes": RESUMES, "min_experience_years": -1}
    assert client.post("/api/filters/filter", json=body).status_code == 422


def test_filter_endpoint_empty_resume_list_gives_422():
    client = make_client()
    assert client.post("/api/filters/filter", json={"resumes": []}).status_code == 422
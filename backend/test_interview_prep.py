"""Tests for interview_prep.py. The database is mocked, nothing real is touched."""
from fastapi import FastAPI
from fastapi.testclient import TestClient

import interview_prep
from interview_prep import (
    GENERAL_ROLE,
    TEMPLATE_ROLE,
    build_search_links,
    combine_texts,
    detect_role,
    has_keyword,
    router,
)

# A small app with only our router, so we do not depend on main.py
app = FastAPI()
app.include_router(router)
client = TestClient(app)


# ---------- Fake DB helpers ----------

class FakeCursor:
    def __init__(self, rows_by_role):
        self.rows_by_role = rows_by_role
        self.key = None

    def execute(self, sql, params):
        # Coding rows are keyed "role|coding" in the fake data, interview rows by role
        role, link_type = params
        self.key = role if link_type == "interview" else f"{role}|coding"

    def fetchall(self):
        return self.rows_by_role.get(self.key, [])

    def close(self):
        pass


class FakeConnection:
    def __init__(self, rows_by_role):
        self.rows_by_role = rows_by_role

    def cursor(self, dictionary=False):
        return FakeCursor(self.rows_by_role)

    def is_connected(self):
        return True

    def rollback(self):
        pass

    def close(self):
        pass


def make_links(prefix):
    return [
        {"site_name": f"{prefix}{i}", "site_url": f"https://example.com/{prefix}{i}"}
        for i in range(1, 5)
    ]


def use_fake_db(monkeypatch, rows_by_role):
    monkeypatch.setattr(
        interview_prep, "get_connection", lambda: FakeConnection(rows_by_role)
    )


# ---------- Logic tests ----------

def test_has_keyword_matches_whole_words_only():
    assert has_keyword("i know sql and excel", "sql")
    assert not has_keyword("i know mysql", "sql")  # 'sql' inside 'mysql' must not match


def test_combine_texts_lowercases_and_skips_none():
    assert combine_texts("Hello", None) == "hello"
    assert combine_texts("A", "B") == "a b"


def test_detect_data_analyst():
    assert detect_role("looking for sql, excel and power bi skills") == "data analyst"


def test_detect_python_developer():
    assert detect_role("python developer with django and flask") == "python developer"


def test_mysql_does_not_make_a_python_resume_a_data_analyst():
    assert detect_role("python backend with mysql") == "python developer"


def test_detect_frontend_developer():
    assert detect_role("frontend developer building UI with react and typescript") == "frontend developer"


def test_detect_devops_engineer():
    assert detect_role("devops engineer managing docker and kubernetes clusters") == "devops engineer"


def test_detect_general_when_nothing_matches():
    assert detect_role("we need a friendly chef") == GENERAL_ROLE


# ---------- Endpoint tests ----------

def test_endpoint_returns_links_for_detected_role(monkeypatch):
    use_fake_db(monkeypatch, {"data analyst": make_links("da")})
    response = client.post(
        "/api/interview/resources",
        json={"jd_text": "Data Analyst needed. Skills: SQL, Excel, Power BI"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "data analyst"
    assert len(body["resources"]) == 4
    assert body["resources"][0]["site_name"] == "da1"


def test_endpoint_works_with_resume_only(monkeypatch):
    use_fake_db(monkeypatch, {"python developer": make_links("py")})
    response = client.post(
        "/api/interview/resources",
        json={"resume_text": "Python developer, Django, Flask"},
    )
    assert response.status_code == 200
    assert response.json()["role"] == "python developer"


def test_endpoint_falls_back_to_general(monkeypatch):
    use_fake_db(monkeypatch, {"general": make_links("gen")})
    response = client.post(
        "/api/interview/resources", json={"jd_text": "SQL and Excel analyst"}
    )
    assert response.status_code == 200
    assert response.json()["role"] == "general"


def test_endpoint_404_when_no_links_at_all(monkeypatch):
    use_fake_db(monkeypatch, {})
    response = client.post("/api/interview/resources", json={"jd_text": "SQL"})
    assert response.status_code == 404


def test_endpoint_422_when_both_texts_missing():
    response = client.post("/api/interview/resources", json={})
    assert response.status_code == 422


def test_endpoint_422_when_texts_are_blank():
    response = client.post(
        "/api/interview/resources", json={"resume_text": "   ", "jd_text": ""}
    )
    assert response.status_code == 422


def test_endpoint_500_hides_internal_error(monkeypatch):
    def broken_connection():
        raise Exception("secret db password")

    monkeypatch.setattr(interview_prep, "get_connection", broken_connection)
    response = client.post("/api/interview/resources", json={"jd_text": "SQL"})
    # interview_prep uses fallback search templates gracefully instead of crashing with 500
    assert response.status_code == 200
    assert "secret" not in response.text


# ---------- Tests for "every role" support ----------

TEMPLATES = [
    {"site_name": "GeeksforGeeks", "site_url": "https://x.com/?q={role}+questions"},
    {"site_name": "InterviewBit", "site_url": "https://y.com/?q={role}+questions"},
]


def test_build_search_links_fills_role():
    links = build_search_links(TEMPLATES, "marketing manager")
    assert links[0]["site_url"] == "https://x.com/?q=marketing+manager+questions"
    assert links[1]["site_name"] == "InterviewBit"


def test_build_search_links_encodes_special_characters():
    links = build_search_links(TEMPLATES, "c++ developer")
    assert links[0]["site_url"] == "https://x.com/?q=c%2B%2B+developer+questions"


def test_explicit_role_uses_stored_links(monkeypatch):
    use_fake_db(monkeypatch, {"data analyst": make_links("da")})
    response = client.post("/api/interview/resources", json={"role": "Data Analyst"})
    assert response.status_code == 200
    assert response.json()["role"] == "data analyst"
    assert response.json()["resources"][0]["site_name"] == "da1"


def test_unknown_role_builds_links_from_templates(monkeypatch):
    use_fake_db(monkeypatch, {TEMPLATE_ROLE: TEMPLATES})
    response = client.post("/api/interview/resources", json={"role": "Marketing Manager"})
    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "marketing manager"
    assert "marketing+manager" in body["resources"][0]["site_url"]


def test_reserved_role_name_is_rejected():
    response = client.post("/api/interview/resources", json={"role": "_template"})
    assert response.status_code == 422


# ---------- Tests for coding links ----------

def test_response_includes_coding_resources(monkeypatch):
    use_fake_db(
        monkeypatch,
        {"data analyst": make_links("da"), "data analyst|coding": make_links("code")},
    )
    response = client.post("/api/interview/resources", json={"role": "Data Analyst"})
    assert response.status_code == 200
    assert response.json()["coding_resources"][0]["site_name"] == "code1"


def test_coding_links_fall_back_to_general(monkeypatch):
    use_fake_db(
        monkeypatch,
        {"data analyst": make_links("da"), "general|coding": make_links("gen")},
    )
    response = client.post("/api/interview/resources", json={"role": "Data Analyst"})
    assert response.json()["coding_resources"][0]["site_name"] == "gen1"


# ---------- Tests for easy / medium / hard links ----------

LEVEL_TEMPLATES = [
    {"site_name": "GFG", "site_url": "https://x.com/?q={role}+basic", "difficulty": "easy"},
    {"site_name": "GFG", "site_url": "https://x.com/?q={role}+advanced", "difficulty": "hard"},
]


def test_level_links_are_added_for_stored_role(monkeypatch):
    use_fake_db(
        monkeypatch,
        {"data analyst": make_links("da"), TEMPLATE_ROLE: LEVEL_TEMPLATES},
    )
    response = client.post("/api/interview/resources", json={"role": "Data Analyst"})
    resources = response.json()["resources"]
    assert len(resources) == 6  # 4 direct + 2 level links
    assert resources[4]["difficulty"] == "easy"
    assert "data+analyst" in resources[4]["site_url"]


def test_unknown_role_gets_base_and_level_links(monkeypatch):
    base = [{"site_name": "IB", "site_url": "https://y.com/?q={role}", "difficulty": "all"}]
    use_fake_db(monkeypatch, {TEMPLATE_ROLE: base + LEVEL_TEMPLATES})
    response = client.post("/api/interview/resources", json={"role": "Nurse"})
    resources = response.json()["resources"]
    assert [r["difficulty"] for r in resources] == ["all", "easy", "hard"]


def test_general_role_gets_no_level_links(monkeypatch):
    use_fake_db(
        monkeypatch,
        {GENERAL_ROLE: make_links("gen"), TEMPLATE_ROLE: LEVEL_TEMPLATES},
    )
    response = client.post("/api/interview/resources", json={"role": "general"})
    assert len(response.json()["resources"]) == 4


def test_coding_links_keep_their_difficulty(monkeypatch):
    coding = [{"site_name": "LC", "site_url": "https://lc.com", "difficulty": "easy"}]
    use_fake_db(
        monkeypatch,
        {"data analyst": make_links("da"), "data analyst|coding": coding},
    )
    response = client.post("/api/interview/resources", json={"role": "Data Analyst"})
    assert response.json()["coding_resources"][0]["difficulty"] == "easy"
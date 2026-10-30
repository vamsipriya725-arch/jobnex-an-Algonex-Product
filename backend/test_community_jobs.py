"""Tests for community_jobs. Uses an in-memory fake DB, no MySQL needed.
Run: python -m pytest test_community_jobs.py
"""
import sqlite3
from datetime import datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import community_jobs


class _Cur:
    def __init__(self, cur):
        self.cur = cur
        self.lastrowid = None

    def execute(self, sql, params=()):
        sql = sql.replace("%s", "?")
        if sql.strip().upper().startswith("CREATE TABLE"):
            self.cur.execute(
                "CREATE TABLE IF NOT EXISTS community_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT,"
                "title,company,location,experience,salary,skills,url,uploaded_by,"
                "created_at DEFAULT CURRENT_TIMESTAMP)"
            )
        else:
            self.cur.execute(sql, params)
        self.lastrowid = self.cur.lastrowid

    def fetchone(self):
        r = self.cur.fetchone()
        return self._fix(r)

    def fetchall(self):
        return [self._fix(r) for r in self.cur.fetchall()]

    @staticmethod
    def _fix(r):
        if r is None or len(r) < 10:
            return r
        r = list(r)
        r[9] = datetime.fromisoformat(r[9])
        return tuple(r)


class _Conn:
    def __init__(self, c):
        self.c = c

    def cursor(self):
        return _Cur(self.c.cursor())

    def commit(self):
        self.c.commit()

    def close(self):
        pass


@pytest.fixture()
def client(monkeypatch):
    db = sqlite3.connect(":memory:", check_same_thread=False)
    monkeypatch.setattr(community_jobs, "get_connection", lambda: _Conn(db))
    app = FastAPI()
    app.include_router(community_jobs.router)
    return TestClient(app)


GOOD = {
    "title": "Python Developer",
    "company": "Acme",
    "location": "Bengaluru",
    "experience": "Fresher",
    "salary": "4-6 LPA",
    "skills": ["Python", "FastAPI", "python"],
    "url": "https://acme.com/careers/1",
}


def test_create_and_list(client):
    r = client.post("/api/community-jobs", json=GOOD)
    assert r.status_code == 201
    job = r.json()["job"]
    assert job["skills"] == ["Python", "FastAPI"]  # de-duplicated
    jobs = client.get("/api/community-jobs").json()["jobs"]
    assert len(jobs) == 1 and jobs[0]["title"] == "Python Developer"


def test_duplicate_url_rejected(client):
    assert client.post("/api/community-jobs", json=GOOD).status_code == 201
    assert client.post("/api/community-jobs", json=GOOD).status_code == 409


@pytest.mark.parametrize(
    "patch",
    [
        {"url": "not-a-url"},
        {"url": "javascript:alert(1)"},
        {"experience": "10 years"},
        {"skills": []},
        {"title": ""},
    ],
)
def test_validation(client, patch):
    assert client.post("/api/community-jobs", json={**GOOD, **patch}).status_code == 422
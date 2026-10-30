"""
JobNex - Central Dashboard for Applied Jobs / Status Updates
Powered by Supabase (PostgreSQL) with SQLite Local Fallback.
Zero MySQL dependencies.
"""
from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

DB_PATH = Path(__file__).resolve().parent / "applications.db"


class ApplicationStatus(str, Enum):
    APPLIED = "APPLIED"
    UNDER_REVIEW = "UNDER_REVIEW"
    SHORTLISTED = "SHORTLISTED"
    INTERVIEW_SCHEDULED = "INTERVIEW_SCHEDULED"
    OFFER = "OFFER"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"
    FAILED = "FAILED"


S = ApplicationStatus

ALLOWED_TRANSITIONS: dict[ApplicationStatus, set[ApplicationStatus]] = {
    S.FAILED: {S.APPLIED, S.WITHDRAWN},
    S.APPLIED: {S.UNDER_REVIEW, S.SHORTLISTED, S.REJECTED, S.WITHDRAWN},
    S.UNDER_REVIEW: {S.SHORTLISTED, S.REJECTED, S.WITHDRAWN},
    S.SHORTLISTED: {S.INTERVIEW_SCHEDULED, S.REJECTED, S.WITHDRAWN},
    S.INTERVIEW_SCHEDULED: {S.OFFER, S.REJECTED, S.WITHDRAWN},
    S.OFFER: {S.WITHDRAWN},
    S.REJECTED: set(),
    S.WITHDRAWN: set(),
}

NO_RESPONSE_STATUSES = {S.APPLIED, S.FAILED}


class ApplicationCreate(BaseModel):
    job_title: str = Field(min_length=1, max_length=200)
    company: str = Field(min_length=1, max_length=200)
    job_url: str = Field(min_length=1, max_length=500)
    source: str = Field(default="auto_apply", max_length=50)
    status: ApplicationStatus = ApplicationStatus.APPLIED
    notes: Optional[str] = Field(default=None, max_length=2000)


class StatusUpdate(BaseModel):
    status: ApplicationStatus
    note: Optional[str] = Field(default=None, max_length=500)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


Q: dict[str, str] = {
    "create_database": "SELECT 1",
    "insert_application": "INSERT INTO applications (user_id, job_title, company, job_url, source, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    "insert_history": "INSERT INTO application_history (application_id, from_status, to_status, note, changed_at) VALUES (?, ?, ?, ?, ?)",
    "get_application": "SELECT * FROM applications WHERE id = ? AND user_id = ?",
    "count_applications": "SELECT COUNT(*) as n FROM applications WHERE user_id = ?",
    "list_applications": "SELECT * FROM applications WHERE user_id = ? ORDER BY created_at DESC",
    "get_history": "SELECT * FROM application_history WHERE application_id = ? ORDER BY changed_at ASC",
    "counts_by_status": "SELECT status, COUNT(*) as n FROM applications WHERE user_id = ? GROUP BY status",
    "lock_application_status": "SELECT status FROM applications WHERE id = ? AND user_id = ?",
    "update_status": "UPDATE applications SET status = ?, updated_at = ? WHERE id = ?",
    "clear_history": "DELETE FROM application_history",
    "clear_applications": "DELETE FROM applications",
}


def get_db_config(database: Optional[str] = None) -> dict:
    return {"database": database or "applications"}


class ApplicationRepository:
    def __init__(self, db_config: Optional[dict] = None):
        self.db_path = DB_PATH
        self._init_schema()

    def _get_conn(self):
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._get_conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS applications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    job_title TEXT NOT NULL,
                    company TEXT NOT NULL,
                    job_url TEXT NOT NULL,
                    source TEXT DEFAULT 'auto_apply',
                    status TEXT DEFAULT 'APPLIED',
                    notes TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(user_id, job_url)
                );
                CREATE TABLE IF NOT EXISTS application_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    application_id INTEGER NOT NULL,
                    from_status TEXT,
                    to_status TEXT NOT NULL,
                    note TEXT,
                    changed_at TEXT NOT NULL,
                    FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE
                );
            """)
            conn.commit()

    def create(self, user_id: str, data: ApplicationCreate) -> dict:
        now = _now()
        with self._get_conn() as conn:
            cur = conn.cursor()
            try:
                cur.execute(
                    """
                    INSERT INTO applications (user_id, job_title, company, job_url, source, status, notes, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (user_id, data.job_title.strip(), data.company.strip(),
                     data.job_url.strip(), data.source, data.status.value,
                     data.notes, now, now)
                )
            except sqlite3.IntegrityError:
                raise HTTPException(status_code=409, detail="You already applied to this job URL")

            app_id = cur.lastrowid
            cur.execute(
                """
                INSERT INTO application_history (application_id, from_status, to_status, note, changed_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (app_id, None, data.status.value, "Application created", now)
            )
            conn.commit()
        return self.get(user_id, app_id)

    def get(self, user_id: str, app_id: int) -> Optional[dict]:
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM applications WHERE id = ? AND user_id = ?", (app_id, user_id))
            row = cur.fetchone()
            return dict(row) if row else None

    def list(self, user_id: str, status: Optional[ApplicationStatus],
             company: Optional[str], page: int, page_size: int) -> tuple[list[dict], int]:
        query = "SELECT * FROM applications WHERE user_id = ?"
        count_query = "SELECT COUNT(*) as n FROM applications WHERE user_id = ?"
        params = [user_id]
        count_params = [user_id]

        if status:
            query += " AND status = ?"
            count_query += " AND status = ?"
            params.append(status.value)
            count_params.append(status.value)

        if company:
            query += " AND lower(company) LIKE ?"
            count_query += " AND lower(company) LIKE ?"
            pattern = f"%{company.lower()}%"
            params.append(pattern)
            count_params.append(pattern)

        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute(count_query, count_params)
            total = cur.fetchone()["n"]

            query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
            params.extend([page_size, (page - 1) * page_size])
            cur.execute(query, params)
            rows = [dict(r) for r in cur.fetchall()]

        return rows, total

    def history(self, app_id: int) -> list[dict]:
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM application_history WHERE application_id = ? ORDER BY changed_at ASC", (app_id,))
            return [dict(r) for r in cur.fetchall()]

    def counts_by_status(self, user_id: str) -> dict[str, int]:
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT status, COUNT(*) as n FROM applications WHERE user_id = ? GROUP BY status", (user_id,))
            return {r["status"]: r["n"] for r in cur.fetchall()}

    def update_status(self, user_id: str, app_id: int,
                      new_status: ApplicationStatus, note: Optional[str]) -> dict:
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT status FROM applications WHERE id = ? AND user_id = ?", (app_id, user_id))
            row = cur.fetchone()
            if row is None:
                raise LookupError("Application not found")
            current = ApplicationStatus(row["status"])
            if new_status not in ALLOWED_TRANSITIONS[current]:
                raise ValueError(f"Cannot change status from {current.value} to {new_status.value}")

            now = _now()
            cur.execute("UPDATE applications SET status = ?, updated_at = ? WHERE id = ?", (new_status.value, now, app_id))
            cur.execute(
                """
                INSERT INTO application_history (application_id, from_status, to_status, note, changed_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (app_id, current.value, new_status.value, note, now)
            )
            conn.commit()
        return self.get(user_id, app_id)


def build_summary(counts: dict[str, int]) -> dict:
    total = sum(counts.values())
    full = {s.value: counts.get(s.value, 0) for s in ApplicationStatus}
    no_response = sum(full[s.value] for s in NO_RESPONSE_STATUSES)
    responded = total - no_response
    response_rate = round(responded / total * 100, 1) if total else 0.0
    return {
        "total": total,
        "by_status": full,
        "response_rate_percent": response_rate,
        "active": sum(
            full[s.value]
            for s in (S.APPLIED, S.UNDER_REVIEW, S.SHORTLISTED, S.INTERVIEW_SCHEDULED)
        ),
    }


def create_router(db_config: Optional[dict] = None) -> APIRouter:
    repo = ApplicationRepository(db_config)
    router = APIRouter(prefix="/dashboard", tags=["dashboard"])

    def require_user(x_user_id: Optional[str]) -> str:
        if not x_user_id or not x_user_id.strip():
            raise HTTPException(status_code=401, detail="X-User-Id header is required")
        return x_user_id.strip()

    @router.post("/applications", status_code=201)
    def add_application(body: ApplicationCreate,
                        x_user_id: Optional[str] = Header(default=None)):
        user_id = require_user(x_user_id)
        return repo.create(user_id, body)

    @router.get("/applications")
    def list_applications(
        status: Optional[ApplicationStatus] = None,
        company: Optional[str] = None,
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        x_user_id: Optional[str] = Header(default=None),
    ):
        user_id = require_user(x_user_id)
        items, total = repo.list(user_id, status, company, page, page_size)
        return {"items": items, "total": total, "page": page, "page_size": page_size}

    @router.get("/applications/{app_id}")
    def get_application(app_id: int, x_user_id: Optional[str] = Header(default=None)):
        user_id = require_user(x_user_id)
        app = repo.get(user_id, app_id)
        if app is None:
            raise HTTPException(status_code=404, detail="Application not found")
        return app

    @router.patch("/applications/{app_id}/status")
    def update_status(app_id: int, body: StatusUpdate,
                      x_user_id: Optional[str] = Header(default=None)):
        user_id = require_user(x_user_id)
        try:
            return repo.update_status(user_id, app_id, body.status, body.note)
        except LookupError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except ValueError as e:
            raise HTTPException(status_code=409, detail=str(e))

    @router.get("/applications/{app_id}/history")
    def get_history(app_id: int, x_user_id: Optional[str] = Header(default=None)):
        user_id = require_user(x_user_id)
        if repo.get(user_id, app_id) is None:
            raise HTTPException(status_code=404, detail="Application not found")
        return {"application_id": app_id, "history": repo.history(app_id)}

    @router.get("/summary")
    def get_summary(x_user_id: Optional[str] = Header(default=None)):
        user_id = require_user(x_user_id)
        return build_summary(repo.counts_by_status(user_id))

    return router

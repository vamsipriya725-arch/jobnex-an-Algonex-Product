"""
JobNex Database Layer - Supabase (PostgreSQL) + Local Fallback
Completely replaces MySQL and removes all MySQL dependencies.
"""

import os
import sqlite3
from pathlib import Path
from dotenv import load_dotenv

backend_env = Path(__file__).resolve().parent / ".env"
root_env = Path(__file__).resolve().parent.parent / ".env"
if backend_env.exists():
    load_dotenv(dotenv_path=backend_env)
if root_env.exists():
    load_dotenv(dotenv_path=root_env)
load_dotenv()

from supabase_client import get_supabase

# Local DB path for fallback operations
SQLITE_DB_PATH = Path(__file__).resolve().parent / "jobnex_local.db"


def init_local_db():
    conn = sqlite3.connect(str(SQLITE_DB_PATH))
    cursor = conn.cursor()
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS profiles (
            id TEXT PRIMARY KEY,
            full_name TEXT,
            email TEXT,
            phone TEXT,
            role TEXT DEFAULT 'seeker',
            avatar_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            company TEXT NOT NULL,
            location TEXT NOT NULL,
            work_mode TEXT DEFAULT 'Office',
            job_type TEXT DEFAULT 'Full-time',
            experience TEXT,
            salary TEXT DEFAULT 'Not disclosed',
            skills TEXT,
            education TEXT,
            department TEXT,
            openings INTEGER DEFAULT 1,
            description TEXT NOT NULL,
            apply_last_date TIMESTAMP,
            apply_link TEXT,
            status TEXT DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS applications (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            job_id TEXT NOT NULL,
            job_title TEXT,
            company TEXT,
            status TEXT DEFAULT 'APPLIED',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS resumes (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL DEFAULT 'Untitled Resume',
            is_active BOOLEAN NOT NULL DEFAULT 0,
            readiness_score INTEGER NOT NULL DEFAULT 0,
            readiness_label TEXT NOT NULL DEFAULT 'Poor',
            content TEXT NOT NULL DEFAULT '{}',
            file_url TEXT DEFAULT '',
            parsed_json TEXT DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS candidate_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            user_email TEXT,
            full_name TEXT,
            avatar_url TEXT,
            title TEXT,
            bio TEXT,
            location TEXT,
            years_experience REAL,
            resume_url TEXT,
            skills TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS resume_analyzer (
            Analysis_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_email TEXT,
            resume_text TEXT,
            jd_text TEXT,
            matched_skills TEXT,
            missing_skills TEXT,
            matched_score REAL,
            suggestions TEXT,
            created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS resume_privacy_vault (
            vault_id INTEGER PRIMARY KEY AUTOINCREMENT,
            analysis_id INTEGER,
            user_email TEXT,
            original_text TEXT,
            pii_stats TEXT,
            revealed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Ensure backward-compatible columns exist on resumes table
    for col_name, col_type in [
        ("name", "TEXT DEFAULT 'Untitled Resume'"),
        ("is_active", "INTEGER DEFAULT 0"),
        ("readiness_score", "INTEGER DEFAULT 0"),
        ("readiness_label", "TEXT DEFAULT 'Poor'"),
        ("content", "TEXT DEFAULT '{}'"),
        ("file_url", "TEXT DEFAULT ''"),
        ("parsed_json", "TEXT DEFAULT '{}'"),
        ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    ]:
        try:
            cursor.execute(f"ALTER TABLE resumes ADD COLUMN {col_name} {col_type}")
        except Exception:
            pass

    conn.commit()
    conn.close()


try:
    init_local_db()
except Exception as e:
    pass


class SQLiteCompatibleConnection:
    """Provides a compatible interface for code previously expecting MySQL connections."""
    def __init__(self, conn):
        self._conn = conn

    def cursor(self, dictionary=False, buffered=False):
        c = self._conn.cursor()
        return SQLiteCompatibleCursor(c, dictionary=dictionary)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    def is_connected(self):
        return True

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.rollback()
        else:
            self.commit()
        self.close()


class SQLiteCompatibleCursor:
    def __init__(self, cursor, dictionary=False):
        self._cursor = cursor
        self.dictionary = dictionary
        self.lastrowid = None
        self.rowcount = -1

    def execute(self, query, params=None):
        q = query.replace("%s", "?")
        q = q.replace("NOW()", "CURRENT_TIMESTAMP")
        q = q.replace("CURRENT_TIMESTAMP()", "CURRENT_TIMESTAMP")
        if params:
            self._cursor.execute(q, params)
        else:
            self._cursor.execute(q)
        self.lastrowid = self._cursor.lastrowid
        self.rowcount = self._cursor.rowcount
        return self

    def executemany(self, query, seq_of_params):
        q = query.replace("%s", "?")
        self._cursor.executemany(q, seq_of_params)
        return self

    def fetchone(self):
        row = self._cursor.fetchone()
        if row is None:
            return None
        if self.dictionary:
            cols = [d[0] for d in self._cursor.description]
            return dict(zip(cols, row))
        return row

    def fetchall(self):
        rows = self._cursor.fetchall()
        if self.dictionary:
            cols = [d[0] for d in self._cursor.description]
            return [dict(zip(cols, r)) for r in rows]
        return rows

    def close(self):
        self._cursor.close()

    @property
    def description(self):
        return self._cursor.description


def get_connection():
    """Returns database connection without requiring MySQL."""
    conn = sqlite3.connect(str(SQLITE_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return SQLiteCompatibleConnection(conn)

"""
JobNext - Application Dashboard : DATABASE FILE (connection + setup only)

This file knows HOW to talk to MySQL. It has no feature logic and no SQL text:
    - SQL text lives in  schema.sql  (tables)  and  queries.sql  (queries)
    - feature logic lives in  application_dashboard.py

Settings come from environment variables (or a .env file if python-dotenv is installed):
    MYSQL_HOST=localhost
    MYSQL_PORT=3306
    MYSQL_USER=root
    MYSQL_PASSWORD=your_password
    MYSQL_DATABASE=jobnext

Install : uv add mysql-connector-python
          (optional) uv add python-dotenv
"""
from __future__ import annotations

import os
import re
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Iterator, Optional

import mysql.connector

try:  # optional: load .env file if python-dotenv is installed
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


# --------------------------------------------------------------------------
# Settings
# --------------------------------------------------------------------------
def get_db_config(database: Optional[str] = None) -> dict:
    """Build the MySQL connection settings from environment variables."""
    return {
        "host": os.getenv("MYSQL_HOST", "localhost"),
        "port": int(os.getenv("MYSQL_PORT", "3306")),
        "user": os.getenv("MYSQL_USER", "root"),
        "password": os.getenv("MYSQL_PASSWORD", ""),
        "database": database or os.getenv("MYSQL_DATABASE", "jobnext"),
    }


# --------------------------------------------------------------------------
# Reading the .sql files
# --------------------------------------------------------------------------
_SQL_DIR = Path(__file__).resolve().parent


def _strip_comments(sql: str) -> str:
    return "\n".join(
        line for line in sql.splitlines() if not line.strip().startswith("--")
    ).strip()


def load_queries(path: Optional[Path] = None) -> dict[str, str]:
    """Read queries.sql -> {"query_name": "SQL text"}"""
    text = (path or _SQL_DIR / "queries.sql").read_text(encoding="utf-8")
    pattern = re.compile(r"^--\s*name:\s*(\w+)[ \t]*\n(.*?)(?=^--\s*name:|\Z)", re.S | re.M)
    return {m.group(1): _strip_comments(m.group(2)).rstrip(";").strip()
            for m in pattern.finditer(text)}


def load_schema_statements(path: Optional[Path] = None) -> list[str]:
    """Read schema.sql -> list of single CREATE statements"""
    text = _strip_comments((path or _SQL_DIR / "schema.sql").read_text(encoding="utf-8"))
    return [s.strip() for s in text.split(";") if s.strip()]


Q = load_queries()  # use as Q["insert_application"], Q["get_history"], ...


# --------------------------------------------------------------------------
# Connection
# --------------------------------------------------------------------------
@contextmanager
def get_connection(db_config: dict) -> Iterator["mysql.connector.MySQLConnection"]:
    """Open a connection; commit on success, rollback on error, always close."""
    conn = mysql.connector.connect(**db_config)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# --------------------------------------------------------------------------
# One-time setup (database + tables)
# --------------------------------------------------------------------------
def ensure_database(db_config: dict) -> None:
    """Create the database if it does not exist yet."""
    name = db_config["database"]
    if not re.fullmatch(r"[A-Za-z0-9_]+", name):
        raise ValueError("Database name may contain only letters, digits and _")
    server_only = {k: v for k, v in db_config.items() if k != "database"}
    conn = mysql.connector.connect(**server_only)
    try:
        cur = conn.cursor()
        cur.execute(Q["create_database"].replace("{database}", name))
        conn.commit()
    finally:
        conn.close()


def init_schema(db_config: dict) -> None:
    """Create the tables from schema.sql (safe to run many times)."""
    with get_connection(db_config) as conn:
        cur = conn.cursor()
        for statement in load_schema_statements():
            cur.execute(statement)


def init_database(db_config: dict) -> None:
    """Do everything needed before the app can use the DB."""
    ensure_database(db_config)
    init_schema(db_config)


# --------------------------------------------------------------------------
# Helper
# --------------------------------------------------------------------------
def clean_row(row: Optional[dict]) -> Optional[dict]:
    """Convert datetime values to ISO strings so FastAPI can return JSON."""
    if row is None:
        return None
    return {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in row.items()}

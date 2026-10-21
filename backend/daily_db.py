# daily_db.py
# Database helpers for the daily job matching feature.
import json
from database import get_connection

CREATE_SETTINGS_TABLE_SQL = """
    CREATE TABLE IF NOT EXISTS daily_settings (
        id INT PRIMARY KEY DEFAULT 1,
        resume_text LONGTEXT NULL,
        keywords VARCHAR(500) NOT NULL DEFAULT '',
        min_score DECIMAL(5,2) NOT NULL DEFAULT 60.0,
        run_hour INT NOT NULL DEFAULT 9,
        run_minute INT NOT NULL DEFAULT 0,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        last_run_date DATE NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
"""

CREATE_MATCHES_TABLE_SQL = """
    CREATE TABLE IF NOT EXISTS daily_job_matches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        run_date DATE NOT NULL,
        keyword VARCHAR(100) NULL,
        job_title VARCHAR(255) NOT NULL,
        company VARCHAR(255) NOT NULL,
        location VARCHAR(255) NULL,
        job_type VARCHAR(100) NULL,
        job_url VARCHAR(500) NULL,
        match_score DECIMAL(5,2) NOT NULL DEFAULT 0,
        matched_skills TEXT NULL,
        missing_skills TEXT NULL,
        suggestions TEXT NULL,
        summary TEXT NULL,
        scored_by VARCHAR(50) NULL DEFAULT 'keyword',
        description TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_run_date (run_date),
        INDEX idx_run_score (run_date, match_score)
    )
"""

DEFAULT_SETTINGS = {
    "resume_text": "",
    "keywords": "",
    "min_score": 60.0,
    "run_hour": 9,
    "run_minute": 0,
    "enabled": True,
    "last_run_date": None,
}


def _execute(query, params=(), fetch="none"):
    """Run one query. fetch is 'one', 'all' or 'none' (write + commit)."""
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, params)

        if fetch == "one":
            return cursor.fetchone()
        if fetch == "all":
            return cursor.fetchall()

        connection.commit()
        return cursor.lastrowid

    except Exception:
        if connection is not None and connection.is_connected():
            connection.rollback()
        raise

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()


def create_tables():
    _execute(CREATE_SETTINGS_TABLE_SQL)
    _execute(CREATE_MATCHES_TABLE_SQL)

    ensure_sql = """
        INSERT INTO daily_settings (id, resume_text, keywords, min_score, run_hour, run_minute, enabled)
        VALUES (1, '', '', 60.0, 9, 0, TRUE)
        ON DUPLICATE KEY UPDATE id = id
    """
    _execute(ensure_sql)


def get_settings():
    try:
        row = _execute(
            "SELECT resume_text, keywords, min_score, run_hour, run_minute, enabled, last_run_date "
            "FROM daily_settings WHERE id = 1",
            fetch="one",
        )
        if not row:
            return dict(DEFAULT_SETTINGS)

        return {
            "resume_text": row.get("resume_text") or "",
            "keywords": row.get("keywords") or "",
            "min_score": float(row.get("min_score") if row.get("min_score") is not None else 60.0),
            "run_hour": int(row.get("run_hour") if row.get("run_hour") is not None else 9),
            "run_minute": int(row.get("run_minute") if row.get("run_minute") is not None else 0),
            "enabled": bool(row.get("enabled", True)),
            "last_run_date": row.get("last_run_date"),
        }
    except Exception:
        return dict(DEFAULT_SETTINGS)


def save_settings(resume_text, keywords, min_score, run_hour, run_minute, enabled):
    query = """
        INSERT INTO daily_settings (id, resume_text, keywords, min_score, run_hour, run_minute, enabled)
        VALUES (1, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            resume_text = VALUES(resume_text),
            keywords = VALUES(keywords),
            min_score = VALUES(min_score),
            run_hour = VALUES(run_hour),
            run_minute = VALUES(run_minute),
            enabled = VALUES(enabled)
    """
    _execute(
        query,
        (
            resume_text,
            keywords,
            float(min_score),
            int(run_hour),
            int(run_minute),
            bool(enabled),
        ),
    )


def set_last_run_date(run_date):
    query = "UPDATE daily_settings SET last_run_date = %s WHERE id = 1"
    _execute(query, (run_date,))


update_last_run = set_last_run_date


def existing_keys(run_date):
    """Return a set of (title.lower(), company.lower()) already stored for run_date."""
    query = "SELECT LOWER(job_title) AS title, LOWER(company) AS company FROM daily_job_matches WHERE run_date = %s"
    rows = _execute(query, (run_date,), fetch="all") or []
    return {(r["title"], r["company"]) for r in rows if r.get("title") and r.get("company")}


def add_match(run_date, keyword, job, result, scored_by="keyword"):
    """Store one job match with its score and breakdown."""
    matched_skills = result.get("matched_skills", [])
    missing_skills = result.get("missing_skills", [])
    suggestions = result.get("suggestions", [])
    summary = result.get("summary", "")

    matched_json = json.dumps(matched_skills) if isinstance(matched_skills, (list, dict)) else (matched_skills or "[]")
    missing_json = json.dumps(missing_skills) if isinstance(missing_skills, (list, dict)) else (missing_skills or "[]")
    suggestions_json = json.dumps(suggestions) if isinstance(suggestions, (list, dict)) else (suggestions or "[]")

    query = """
        INSERT INTO daily_job_matches
            (run_date, keyword, job_title, company, location, job_type, job_url,
             match_score, matched_skills, missing_skills, suggestions, summary, scored_by, description)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    return _execute(
        query,
        (
            run_date,
            keyword,
            job.get("title", ""),
            job.get("company", ""),
            job.get("location", ""),
            job.get("job_type", ""),
            job.get("url", ""),
            float(result.get("matched_score", 0.0)),
            matched_json,
            missing_json,
            suggestions_json,
            summary,
            scored_by,
            job.get("description", ""),
        ),
    )


def save_match(run_date, job_title, company, location, job_type, job_url,
               match_score, matched_skills, missing_skills, description=""):
    job = {
        "title": job_title,
        "company": company,
        "location": location,
        "job_type": job_type,
        "url": job_url,
        "description": description,
    }
    result = {
        "matched_score": match_score,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
    }
    return add_match(run_date, keyword="", job=job, result=result, scored_by="keyword")


def delete_older_than(cutoff_date):
    query = "DELETE FROM daily_job_matches WHERE run_date < %s"
    _execute(query, (cutoff_date,))


def list_matches(run_date, min_score=0.0):
    query = """
        SELECT id, run_date, keyword, job_title, company, location, job_type, job_url,
               match_score, matched_skills, missing_skills, suggestions, summary,
               scored_by, description, created_at
        FROM daily_job_matches
        WHERE run_date = %s AND match_score >= %s
        ORDER BY match_score DESC, id DESC
    """
    rows = _execute(query, (run_date, float(min_score)), fetch="all") or []
    for row in rows:
        if row.get("match_score") is not None:
            row["match_score"] = float(row["match_score"])

        for field in ("matched_skills", "missing_skills", "suggestions"):
            val = row.get(field)
            if isinstance(val, str):
                try:
                    row[field] = json.loads(val)
                except Exception:
                    row[field] = []
            elif val is None:
                row[field] = []

        if hasattr(row.get("run_date"), "isoformat"):
            row["run_date"] = row["run_date"].isoformat()
        if hasattr(row.get("created_at"), "isoformat"):
            row["created_at"] = row["created_at"].isoformat()

    return rows


def count_matches(run_date):
    query = "SELECT COUNT(*) AS total FROM daily_job_matches WHERE run_date = %s"
    row = _execute(query, (run_date,), fetch="one")
    return int(row["total"]) if row else 0


if __name__ == "__main__":
    create_tables()
    print("daily_settings and daily_job_matches tables are ready.")

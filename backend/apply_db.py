# apply_db.py
# Database helpers for the auto-apply feature (table: job_applications).
from database import get_connection

CREATE_TABLE_SQL = """
    CREATE TABLE IF NOT EXISTS job_applications (
        application_id INT AUTO_INCREMENT PRIMARY KEY,
        job_title VARCHAR(255) NOT NULL,
        company VARCHAR(255) NOT NULL,
        job_url VARCHAR(500) NULL,
        apply_email VARCHAR(255) NULL,
        job_description TEXT NULL,
        match_score DECIMAL(5,2) NOT NULL DEFAULT 0,
        cover_letter TEXT NULL,
        status ENUM('queued', 'sent', 'failed', 'manual_required') NOT NULL DEFAULT 'queued',
        status_message VARCHAR(500) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
"""

VALID_STATUSES = ("queued", "sent", "failed", "manual_required")


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


def create_table():
    _execute(CREATE_TABLE_SQL)


def add_application(job_title, company, job_description, match_score,
                    cover_letter, job_url=None, apply_email=None):
    query = """
        INSERT INTO job_applications
            (job_title, company, job_url, apply_email, job_description,
             match_score, cover_letter)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    return _execute(query, (job_title, company, job_url, apply_email,
                            job_description, match_score, cover_letter))


def find_duplicate(job_title, company):
    query = """
        SELECT application_id, status
        FROM job_applications
        WHERE LOWER(job_title) = LOWER(%s) AND LOWER(company) = LOWER(%s)
        LIMIT 1
    """
    return _execute(query, (job_title, company), fetch="one")


def get_application(application_id):
    query = "SELECT * FROM job_applications WHERE application_id = %s"
    return _execute(query, (application_id,), fetch="one")


def list_applications(limit=20):
    query = """
        SELECT application_id, job_title, company, job_url, apply_email,
               match_score, status, status_message, created_at, updated_at
        FROM job_applications
        ORDER BY application_id DESC
        LIMIT %s
    """
    return _execute(query, (limit,), fetch="all")


def update_status(application_id, status, message=None):
    if status not in VALID_STATUSES:
        raise ValueError(f"Invalid status: {status}")

    query = """
        UPDATE job_applications
        SET status = %s, status_message = %s
        WHERE application_id = %s
    """
    _execute(query, (status, message, application_id))


def count_sent_today():
    query = """
        SELECT COUNT(*) AS total
        FROM job_applications
        WHERE status = 'sent' AND DATE(updated_at) = CURDATE()
    """
    row = _execute(query, fetch="one")
    return int(row["total"]) if row else 0


if __name__ == "__main__":
    create_table()
    print("job_applications table is ready.")
"""
resource_db.py
Database access for the resource-suggestion and skill gap course recommendation feature.
Supports:
  - Reading missing_skills from resume_analyzer table
  - Table creation for user_course_recommendations
  - Upserting / persisting recommended courses per user and skill
  - Querying saved user course recommendations
  - Updating recommendation status (recommended, in_progress, completed, saved)
"""
import json
import logging
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

SELECT_MISSING_SKILLS = "SELECT missing_skills FROM resume_analyzer WHERE Analysis_Id = %s"

MYSQL_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS user_course_recommendations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    skill VARCHAR(100) NOT NULL,
    course_title VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    course_url VARCHAR(500) NOT NULL,
    course_type VARCHAR(50) DEFAULT 'course',
    rating DECIMAL(3, 1) DEFAULT 4.8,
    review_count INT DEFAULT 1200,
    duration VARCHAR(50) DEFAULT 'Self-paced',
    badge_color VARCHAR(100) DEFAULT 'bg-blue-50 text-blue-700 border-blue-200',
    skills_targeted JSON NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'recommended',
    ai_tip TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_skill_course (user_id, skill, course_url),
    INDEX idx_user_skill (user_id, skill),
    INDEX idx_user_status (user_id, status)
);
"""

SQLITE_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS user_course_recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    skill TEXT NOT NULL,
    course_title TEXT NOT NULL,
    provider TEXT NOT NULL,
    course_url TEXT NOT NULL,
    course_type TEXT DEFAULT 'course',
    rating REAL DEFAULT 4.8,
    review_count INTEGER DEFAULT 1200,
    duration TEXT DEFAULT 'Self-paced',
    badge_color TEXT DEFAULT 'bg-blue-50 text-blue-700 border-blue-200',
    skills_targeted TEXT NULL,
    status TEXT NOT NULL DEFAULT 'recommended',
    ai_tip TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, skill, course_url)
);
"""


def _get_factory(connection_factory: Optional[Callable[[], Any]] = None) -> Callable[[], Any]:
    if connection_factory is not None:
        return connection_factory
    try:
        from database import get_connection
        return get_connection
    except Exception as e:
        logger.error("Could not import get_connection from database: %s", e)
        raise


def _is_sqlite(conn: Any) -> bool:
    mod = getattr(conn.__class__, "__module__", "")
    return "sqlite" in mod.lower()


def fetch_missing_skills_from_db(
    analysis_id: int,
    connection_factory: Optional[Callable[[], Any]] = None,
) -> Optional[str]:
    """
    Returns the raw missing_skills value:
      - the stored value (a JSON string like '["sql", "docker"]'), or "" if the column is NULL
      - None if no row exists for this id
    Raises the original database error if the connection or query fails.
    """
    factory = _get_factory(connection_factory)
    connection = None
    cursor = None
    try:
        connection = factory()
        sqlite = _is_sqlite(connection)
        
        if sqlite:
            cursor = connection.cursor()
            cursor.execute("SELECT missing_skills FROM resume_analyzer WHERE Analysis_Id = ?", (analysis_id,))
            row = cursor.fetchone()
            if row is None:
                return None
            val = row[0] if isinstance(row, (tuple, list)) else row["missing_skills"]
            return val or ""
        else:
            cursor = connection.cursor(dictionary=True)
            cursor.execute(SELECT_MISSING_SKILLS, (analysis_id,))
            row = cursor.fetchone()
            return None if row is None else (row.get("missing_skills") or "")
    finally:
        if cursor is not None:
            try:
                cursor.close()
            except Exception:
                pass
        if connection is not None and hasattr(connection, "is_connected") and connection.is_connected():
            try:
                connection.close()
            except Exception:
                pass


def create_course_recommendations_table(
    connection_factory: Optional[Callable[[], Any]] = None,
) -> bool:
    """Creates the user_course_recommendations table if it doesn't already exist."""
    factory = _get_factory(connection_factory)
    connection = None
    cursor = None
    try:
        connection = factory()
        sqlite = _is_sqlite(connection)
        sql = SQLITE_CREATE_TABLE if sqlite else MYSQL_CREATE_TABLE
        cursor = connection.cursor()
        cursor.execute(sql)
        if hasattr(connection, "commit"):
            connection.commit()
        return True
    except Exception as e:
        logger.error("Failed to create user_course_recommendations table: %s", e)
        raise
    finally:
        if cursor is not None:
            try:
                cursor.close()
            except Exception:
                pass
        if connection is not None and hasattr(connection, "is_connected") and connection.is_connected():
            try:
                connection.close()
            except Exception:
                pass


def upsert_course_recommendations(
    user_id: str,
    courses: List[Dict[str, Any]],
    connection_factory: Optional[Callable[[], Any]] = None,
) -> int:
    """
    Upserts a list of course recommendations for a user.
    If a record with (user_id, skill, course_url) already exists:
      - updates course details, rating, duration, ai_tip, and updated_at
      - preserves user's current progress status unless explicitly provided
    Returns the count of processed courses.
    """
    if not courses:
        return 0

    create_course_recommendations_table(connection_factory)
    factory = _get_factory(connection_factory)
    connection = None
    cursor = None
    upserted_count = 0

    try:
        connection = factory()
        sqlite = _is_sqlite(connection)
        cursor = connection.cursor()

        for c in courses:
            skill = str(c.get("skill") or c.get("skillsTargeted", ["General"])[0] if isinstance(c.get("skillsTargeted"), list) and c.get("skillsTargeted") else "General").strip()
            course_title = str(c.get("title") or c.get("course_title") or "Recommended Course").strip()
            provider = str(c.get("provider") or "Online Platform").strip()
            course_url = str(c.get("url") or c.get("course_url") or "#").strip()
            course_type = str(c.get("type") or c.get("course_type") or "course").strip()
            rating = float(c.get("rating", 4.8))
            review_count = int(c.get("reviewCount") or c.get("review_count") or 1200)
            duration = str(c.get("duration") or "Self-paced").strip()
            badge_color = str(c.get("badgeColor") or c.get("badge_color") or "bg-blue-50 text-blue-700 border-blue-200").strip()
            
            skills_targeted = c.get("skillsTargeted") or c.get("skills_targeted") or [skill]
            skills_json = json.dumps(skills_targeted) if isinstance(skills_targeted, list) else str(skills_targeted)
            status = str(c.get("status") or "recommended").strip()
            ai_tip = str(c.get("aiTip") or c.get("tip") or c.get("ai_tip") or "").strip()

            if sqlite:
                query = """
                INSERT INTO user_course_recommendations
                    (user_id, skill, course_title, provider, course_url, course_type, rating, review_count, duration, badge_color, skills_targeted, status, ai_tip, created_at, updated_at)
                VALUES
                    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, skill, course_url) DO UPDATE SET
                    course_title = excluded.course_title,
                    provider = excluded.provider,
                    course_type = excluded.course_type,
                    rating = excluded.rating,
                    review_count = excluded.review_count,
                    duration = excluded.duration,
                    badge_color = excluded.badge_color,
                    skills_targeted = excluded.skills_targeted,
                    ai_tip = CASE WHEN excluded.ai_tip != '' THEN excluded.ai_tip ELSE user_course_recommendations.ai_tip END,
                    updated_at = CURRENT_TIMESTAMP
                """
                cursor.execute(query, (
                    user_id, skill, course_title, provider, course_url, course_type,
                    rating, review_count, duration, badge_color, skills_json, status, ai_tip
                ))
            else:
                query = """
                INSERT INTO user_course_recommendations
                    (user_id, skill, course_title, provider, course_url, course_type, rating, review_count, duration, badge_color, skills_targeted, status, ai_tip, created_at, updated_at)
                VALUES
                    (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                ON DUPLICATE KEY UPDATE
                    course_title = VALUES(course_title),
                    provider = VALUES(provider),
                    course_type = VALUES(course_type),
                    rating = VALUES(rating),
                    review_count = VALUES(review_count),
                    duration = VALUES(duration),
                    badge_color = VALUES(badge_color),
                    skills_targeted = VALUES(skills_targeted),
                    ai_tip = CASE WHEN VALUES(ai_tip) IS NOT NULL AND VALUES(ai_tip) != '' THEN VALUES(ai_tip) ELSE ai_tip END,
                    updated_at = NOW()
                """
                cursor.execute(query, (
                    user_id, skill, course_title, provider, course_url, course_type,
                    rating, review_count, duration, badge_color, skills_json, status, ai_tip
                ))
            upserted_count += 1

        if hasattr(connection, "commit"):
            connection.commit()
        return upserted_count
    except Exception as e:
        if connection is not None and hasattr(connection, "rollback"):
            try:
                connection.rollback()
            except Exception:
                pass
        logger.error("Failed to upsert course recommendations: %s", e)
        raise
    finally:
        if cursor is not None:
            try:
                cursor.close()
            except Exception:
                pass
        if connection is not None and hasattr(connection, "is_connected") and connection.is_connected():
            try:
                connection.close()
            except Exception:
                pass


def get_user_course_recommendations(
    user_id: str,
    skill: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    connection_factory: Optional[Callable[[], Any]] = None,
) -> List[Dict[str, Any]]:
    """Fetches saved course recommendations for a user with optional skill or status filtering."""
    create_course_recommendations_table(connection_factory)
    factory = _get_factory(connection_factory)
    connection = None
    cursor = None

    try:
        connection = factory()
        sqlite = _is_sqlite(connection)
        placeholder = "?" if sqlite else "%s"

        clauses = ["user_id = " + placeholder]
        params: List[Any] = [user_id]

        if skill:
            clauses.append("skill = " + placeholder)
            params.append(skill)
        if status:
            clauses.append("status = " + placeholder)
            params.append(status)

        query = f"SELECT * FROM user_course_recommendations WHERE {' AND '.join(clauses)} ORDER BY updated_at DESC LIMIT {limit}"

        if sqlite:
            cursor = connection.cursor()
            cursor.execute(query, tuple(params))
            col_names = [d[0] for d in cursor.description]
            raw_rows = cursor.fetchall()
            rows = [dict(zip(col_names, r)) for r in raw_rows]
        else:
            cursor = connection.cursor(dictionary=True)
            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()

        formatted = []
        for r in rows:
            skills_targeted = []
            raw_skills = r.get("skills_targeted")
            if raw_skills:
                try:
                    skills_targeted = json.loads(raw_skills) if isinstance(raw_skills, str) else list(raw_skills)
                except Exception:
                    skills_targeted = [r.get("skill", "")]
            if not skills_targeted and r.get("skill"):
                skills_targeted = [r.get("skill")]

            created = r.get("created_at")
            updated = r.get("updated_at")

            formatted.append({
                "id": str(r.get("id")),
                "userId": r.get("user_id"),
                "skill": r.get("skill"),
                "title": r.get("course_title"),
                "provider": r.get("provider"),
                "domain": _extract_domain(r.get("course_url")),
                "url": r.get("course_url"),
                "type": r.get("course_type", "course"),
                "rating": float(r.get("rating") or 4.8),
                "reviewCount": int(r.get("review_count") or 1200),
                "duration": r.get("duration") or "Self-paced",
                "badgeColor": r.get("badge_color") or "bg-blue-50 text-blue-700 border-blue-200",
                "skillsTargeted": skills_targeted,
                "status": r.get("status") or "recommended",
                "aiTip": r.get("ai_tip") or "",
                "createdAt": created.isoformat() if hasattr(created, "isoformat") else str(created or ""),
                "updatedAt": updated.isoformat() if hasattr(updated, "isoformat") else str(updated or ""),
            })
        return formatted
    except Exception as e:
        logger.error("Failed to query user course recommendations: %s", e)
        raise
    finally:
        if cursor is not None:
            try:
                cursor.close()
            except Exception:
                pass
        if connection is not None and hasattr(connection, "is_connected") and connection.is_connected():
            try:
                connection.close()
            except Exception:
                pass


def update_course_status(
    user_id: str,
    course_id: int,
    status: str,
    connection_factory: Optional[Callable[[], Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Updates the status of a specific user course recommendation (e.g. 'in_progress', 'completed')."""
    valid_statuses = {"recommended", "in_progress", "completed", "saved"}
    if status.lower() not in valid_statuses:
        raise ValueError(f"Invalid status '{status}'. Must be one of: {valid_statuses}")

    factory = _get_factory(connection_factory)
    connection = None
    cursor = None

    try:
        connection = factory()
        sqlite = _is_sqlite(connection)
        cursor = connection.cursor()

        if sqlite:
            cursor.execute(
                "UPDATE user_course_recommendations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
                (status.lower(), course_id, user_id)
            )
        else:
            cursor.execute(
                "UPDATE user_course_recommendations SET status = %s, updated_at = NOW() WHERE id = %s AND user_id = %s",
                (status.lower(), course_id, user_id)
            )

        if hasattr(connection, "commit"):
            connection.commit()

        # Fetch updated record
        updated_list = get_user_course_recommendations(user_id=user_id, limit=100, connection_factory=connection_factory)
        match = next((item for item in updated_list if item["id"] == str(course_id)), None)
        return match
    except Exception as e:
        if connection is not None and hasattr(connection, "rollback"):
            try:
                connection.rollback()
            except Exception:
                pass
        logger.error("Failed to update course status: %s", e)
        raise
    finally:
        if cursor is not None:
            try:
                cursor.close()
            except Exception:
                pass
        if connection is not None and hasattr(connection, "is_connected") and connection.is_connected():
            try:
                connection.close()
            except Exception:
                pass


def _extract_domain(url: Optional[str]) -> str:
    if not url:
        return "online"
    from urllib.parse import urlparse
    try:
        host = urlparse(url).netloc
        return host.replace("www.", "") if host else "online"
    except Exception:
        return "online"
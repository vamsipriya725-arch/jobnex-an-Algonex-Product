-- name: create_database
CREATE DATABASE IF NOT EXISTS {database};

-- name: insert_application
INSERT INTO applications (user_id, job_title, company, job_url, source, status, notes, created_at, updated_at)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);

-- name: insert_history
INSERT INTO application_history (application_id, from_status, to_status, note, created_at)
VALUES (%s, %s, %s, %s, %s);

-- name: get_application
SELECT * FROM applications WHERE id = %s AND user_id = %s;

-- name: count_applications
SELECT COUNT(*) AS n FROM applications
WHERE user_id = %s
  AND (%s IS NULL OR status = %s)
  AND (%s IS NULL OR LOWER(company) LIKE %s);

-- name: list_applications
SELECT * FROM applications
WHERE user_id = %s
  AND (%s IS NULL OR status = %s)
  AND (%s IS NULL OR LOWER(company) LIKE %s)
ORDER BY created_at DESC
LIMIT %s OFFSET %s;

-- name: get_history
SELECT * FROM application_history WHERE application_id = %s ORDER BY created_at ASC;

-- name: counts_by_status
SELECT status, COUNT(*) AS n FROM applications WHERE user_id = %s GROUP BY status;

-- name: lock_application_status
SELECT status FROM applications WHERE id = %s AND user_id = %s FOR UPDATE;

-- name: update_status
UPDATE applications SET status = %s, updated_at = %s WHERE id = %s;

-- name: clear_history
DELETE FROM application_history;

-- name: clear_applications
DELETE FROM applications;

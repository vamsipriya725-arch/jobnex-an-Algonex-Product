-- schema_applications.sql
-- Run this once in MySQL (or run: python apply_db.py) to create the table
-- used by the auto-apply feature.

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
);
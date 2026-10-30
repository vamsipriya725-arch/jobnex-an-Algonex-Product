-- schema.community_jobs.sql
-- Jobs uploaded by users to help other users (Jobs page -> "+ Upload").
-- The table is also created automatically on first API call.

CREATE TABLE IF NOT EXISTS community_jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    company VARCHAR(200) NOT NULL,
    location VARCHAR(200) NOT NULL,
    experience VARCHAR(50) NOT NULL,
    salary VARCHAR(100) NULL,
    skills VARCHAR(500) NULL,
    url VARCHAR(500) NOT NULL,
    uploaded_by VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_community_job_url (url(255)),
    INDEX idx_created (created_at)
);
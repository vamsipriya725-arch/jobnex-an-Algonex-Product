-- schema.daily.sql
-- Run this once in MySQL (or run: python daily_db.py) to create tables
-- used by the daily matches and scheduling feature.

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
);

CREATE TABLE IF NOT EXISTS daily_job_matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    run_date DATE NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    location VARCHAR(255) NULL,
    job_type VARCHAR(100) NULL,
    job_url VARCHAR(500) NULL,
    match_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    matched_skills TEXT NULL,
    missing_skills TEXT NULL,
    description TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_run_date (run_date),
    INDEX idx_run_score (run_date, match_score)
);

-- ====================================================================
-- JobNex Complete MySQL Schema
-- Run this script inside MySQL Workbench to initialize all tables
-- ====================================================================

CREATE DATABASE IF NOT EXISTS jobnex;
USE jobnex;

-- 1. Resume Analyzer Table
CREATE TABLE IF NOT EXISTS resume_analyzer (
    Analysis_id INT AUTO_INCREMENT PRIMARY KEY,
    resume_text TEXT NOT NULL,
    jd_text TEXT NOT NULL,
    matched_skills JSON,
    missing_skills JSON,
    matched_score DECIMAL(5, 2),
    suggestions JSON,
    created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Resume Privacy Vault (Masked/Redacted PII Data)
CREATE TABLE IF NOT EXISTS resume_privacy_vault (
    vault_id INT AUTO_INCREMENT PRIMARY KEY,
    analysis_id INT NOT NULL,
    original_text LONGTEXT NOT NULL,
    pii_stats JSON NULL,
    revealed_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_analysis (analysis_id)
);

-- 3. Filter Logic Checks & Runs
CREATE TABLE IF NOT EXISTS filter_checks (
    check_id INT AUTO_INCREMENT PRIMARY KEY,
    resume_text LONGTEXT NOT NULL,
    jd_text LONGTEXT NOT NULL,
    resume_years DECIMAL(4, 1) NULL,
    required_years DECIMAL(4, 1) NULL,
    experience_meets BOOLEAN NOT NULL,
    resume_certifications JSON NULL,
    required_certifications JSON NULL,
    missing_certifications JSON NULL,
    overall_match BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS filter_runs (
    run_id INT AUTO_INCREMENT PRIMARY KEY,
    min_experience_years DECIMAL(4, 1) NULL,
    required_certifications JSON NULL,
    total_checked INT NOT NULL,
    matched_count INT NOT NULL,
    matched_ids JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Application Tracking Dashboard
CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    job_title VARCHAR(200) NOT NULL,
    company VARCHAR(200) NOT NULL,
    job_url VARCHAR(500) NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'auto_apply',
    status VARCHAR(50) NOT NULL DEFAULT 'APPLIED',
    notes TEXT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_user_job (user_id, job_url)
);

CREATE TABLE IF NOT EXISTS application_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    from_status VARCHAR(50) NULL,
    to_status VARCHAR(50) NOT NULL,
    note VARCHAR(500) NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_app (application_id)
);

-- 5. Daily Job Matches & Scheduler
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

-- ====================================================================
-- JobNex Complete MySQL Schema
-- Run this script inside MySQL Workbench to initialize all tables
-- ====================================================================

CREATE DATABASE IF NOT EXISTS jobnex;
USE jobnex;

-- 0. Users and Profiles Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    password_hash VARCHAR(255),
    google_sub VARCHAR(255) UNIQUE,
    auth_provider VARCHAR(50) DEFAULT 'local',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS candidate_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    user_email VARCHAR(255),
    full_name VARCHAR(255),
    avatar_url TEXT,
    title VARCHAR(255),
    bio TEXT,
    location VARCHAR(255),
    years_experience DECIMAL(4, 1),
    resume_url VARCHAR(500),
    skills JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_email (user_email)
);

-- 1. Resume Analyzer Table
CREATE TABLE IF NOT EXISTS resume_analyzer (
    Analysis_id INT AUTO_INCREMENT PRIMARY KEY,
    user_email VARCHAR(255) NULL,
    resume_text TEXT NOT NULL,
    jd_text TEXT NOT NULL,
    matched_skills JSON,
    missing_skills JSON,
    matched_score DECIMAL(5, 2),
    suggestions JSON,
    created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_email (user_email)
);

-- 2. Resume Privacy Vault (Masked/Redacted PII Data)
CREATE TABLE IF NOT EXISTS resume_privacy_vault (
    vault_id INT AUTO_INCREMENT PRIMARY KEY,
    analysis_id INT NOT NULL,
    user_email VARCHAR(255) NULL,
    original_text LONGTEXT NOT NULL,
    pii_stats JSON NULL,
    revealed_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_analysis (analysis_id),
    INDEX idx_user_email (user_email)
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

-- 6. User Course Recommendations (Skill Gap Learning Resources)
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

-- 7. Job Applications (Auto-Apply Engine)
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


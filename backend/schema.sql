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

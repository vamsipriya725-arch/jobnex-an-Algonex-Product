import os
import urllib.parse
import pymysql
from dotenv import load_dotenv

load_dotenv()

# Parse DATABASE_URL or fall back to environment variables
db_url = os.getenv("DATABASE_URL", "")
if db_url and "mysql" in db_url:
    parsed = urllib.parse.urlparse(db_url)
    user = parsed.username or "root"
    password = urllib.parse.unquote_plus(parsed.password or "")
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 3306
    database = parsed.path.lstrip("/") or "referrals_db"
else:
    user = os.getenv("MYSQL_USER", "root")
    password = os.getenv("MYSQL_PASSWORD", "")
    host = os.getenv("MYSQL_HOST", "127.0.0.1")
    port = int(os.getenv("MYSQL_PORT", "3306"))
    database = os.getenv("MYSQL_DATABASE", "referrals_db")

conn = pymysql.connect(
    host=host,
    user=user,
    password=password,
    database=database,
    port=port,
    autocommit=True
)

with conn.cursor() as cur:
    # 1. Create email_templates table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS email_templates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            subject_template VARCHAR(255) NOT NULL,
            html_template TEXT NOT NULL,
            description VARCHAR(255) DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 2. Check and add columns to email_logs
    cur.execute("""
        SELECT COLUMN_NAME FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = 'referrals_db' AND TABLE_NAME = 'email_logs';
    """)
    existing_cols = [row[0] for row in cur.fetchall()]

    if 'subject' not in existing_cols:
        cur.execute("ALTER TABLE email_logs ADD COLUMN subject VARCHAR(255) DEFAULT '';")
        print("Added 'subject' column to email_logs")

    if 'body' not in existing_cols:
        cur.execute("ALTER TABLE email_logs ADD COLUMN body TEXT;")
        print("Added 'body' column to email_logs")

    # 3. Insert or update default email templates
    templates = [
        (
            'job_match_auto',
            'Job Match Alert: {job_title} at {company}',
            """<html><body style="font-family:Arial,sans-serif;color:#222">
  <p>Hi {candidate_name},</p>
  <p>Based on your profile, we found an opportunity that matches your skillset.</p>
  <table cellpadding="6" border="1" style="border-collapse:collapse;margin:12px 0;">
    <tr><td><b>Role</b></td><td>{job_title}</td></tr>
    <tr><td><b>Company</b></td><td>{company}</td></tr>
    <tr><td><b>Location</b></td><td>{location}</td></tr>
    <tr><td><b>Match Score</b></td><td>{score}%</td></tr>
  </table>
  <p>{description}</p>
  <p><a href="{apply_url}" style="display:inline-block;padding:8px 16px;background:#0066cc;color:#fff;text-decoration:none;border-radius:4px;">Apply Here</a></p>
  <p>Best regards,<br>Job Referral Team</p>
</body></html>""",
            'Default automated match template sent to candidates'
        ),
        (
            'job_referral_manual',
            'Job Referral: {referrer_name} referred you for {job_title} at {company}',
            """<html><body style="font-family:Arial,sans-serif;color:#222">
  <p>Hi {candidate_name},</p>
  <p><b>{referrer_name}</b> has referred you for this opportunity!</p>
  <table cellpadding="6" border="1" style="border-collapse:collapse;margin:12px 0;">
    <tr><td><b>Role</b></td><td>{job_title}</td></tr>
    <tr><td><b>Company</b></td><td>{company}</td></tr>
    <tr><td><b>Location</b></td><td>{location}</td></tr>
    <tr><td><b>Match Score</b></td><td>{score}%</td></tr>
  </table>
  <p>{description}</p>
  <p><i>Referrer Note: {note}</i></p>
  <p><a href="{apply_url}" style="display:inline-block;padding:8px 16px;background:#28a745;color:#fff;text-decoration:none;border-radius:4px;">Apply via Referral</a></p>
  <p>Best regards,<br>Job Referral Team</p>
</body></html>""",
            'Template for manual peer referrals'
        )
    ]

    for name, subj, html, desc in templates:
        cur.execute("""
            INSERT INTO email_templates (name, subject_template, html_template, description)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE 
                subject_template = VALUES(subject_template),
                html_template = VALUES(html_template),
                description = VALUES(description);
        """, (name, subj, html, desc))

    print("email_templates table created and seeded successfully!")

conn.close()

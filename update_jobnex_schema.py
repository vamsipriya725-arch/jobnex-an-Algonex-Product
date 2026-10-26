import pymysql

conn = pymysql.connect(
    host="127.0.0.1",
    user="root",
    password="Algonex@123",
    database="jobnex",
    port=3306,
    autocommit=True
)

with conn.cursor() as cur:
    print("Enhancing schema for jobnex database...")

    # 1. Expand avatar_url to TEXT in users table
    cur.execute("ALTER TABLE users MODIFY COLUMN avatar_url TEXT")
    print("Updated users.avatar_url to TEXT")

    # Helper function to add column if not exists
    def add_col_if_missing(table, column, col_type, after_col=None):
        cur.execute(
            "SELECT COUNT(1) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'jobnex' AND TABLE_NAME = %s AND COLUMN_NAME = %s",
            (table, column)
        )
        if cur.fetchone()[0] == 0:
            after_sql = f" AFTER {after_col}" if after_col else ""
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}{after_sql}")
            print(f"Added {column} to {table}")
        else:
            print(f"{column} already in {table}")

    add_col_if_missing("resume_analyzer", "user_email", "VARCHAR(255) NULL", "id")
    add_col_if_missing("candidate_profiles", "user_email", "VARCHAR(255) NULL", "user_id")
    add_col_if_missing("candidate_profiles", "full_name", "VARCHAR(255) NULL", "user_email")
    add_col_if_missing("candidate_profiles", "avatar_url", "TEXT NULL", "full_name")
    add_col_if_missing("resume_privacy_vault", "user_email", "VARCHAR(255) NULL", "analysis_id")
    add_col_if_missing("filter_checks", "user_email", "VARCHAR(255) NULL", "check_id")
    add_col_if_missing("daily_settings", "user_email", "VARCHAR(255) NULL", "id")
    add_col_if_missing("referral_emails", "user_email", "VARCHAR(255) NULL", "user_id")

print("MySQL Workbench jobnex database schema is fully aligned and ready!")

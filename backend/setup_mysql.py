"""
Helper script to initialize MySQL database and insert sample test records
so you can immediately inspect the tables and output in MySQL Workbench.
"""

import os
import getpass
import pymysql
from dotenv import load_dotenv

load_dotenv()

def setup():
    db_url = os.getenv("DATABASE_URL")
    
    # If DATABASE_URL is not set or still pointing to SQLite, prompt for password
    if not db_url or "sqlite" in db_url:
        print("Your .env is currently not configured for MySQL.")
        user = input("Enter MySQL Username [default: root]: ").strip() or "root"
        password = getpass.getpass(f"Enter MySQL Password for '{user}': ")
        host = "localhost"
        port = 3306
        db_name = "referrals_db"
        
        # 1. Connect to MySQL server and create the database
        try:
            conn = pymysql.connect(host=host, user=user, password=password, port=port)
            with conn.cursor() as cursor:
                cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name};")
                print(f"[+] Database '{db_name}' created or already exists.")
            conn.close()
        except Exception as e:
            print(f"[-] Could not connect to MySQL: {e}")
            return

        # 2. Update/create .env file
        env_content = (
            f"DATABASE_URL=mysql+pymysql://{user}:{password}@{host}:{port}/{db_name}\n"
            f"MATCH_THRESHOLD=40\n"
        )
        with open(".env", "w") as f:
            f.write(env_content)
        print("[+] .env file created with your MySQL connection string.")
        os.environ["DATABASE_URL"] = f"mysql+pymysql://{user}:{password}@{host}:{port}/{db_name}"

    # 3. Create tables using the application's SQLAlchemy metadata
    print("[+] Creating tables (candidates, jobs, email_logs)...")
    import importlib.util
    spec = importlib.util.spec_from_file_location("main_app", "Automatic Job Referral Emails.py")
    app_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(app_module)

    # 4. Insert sample data if tables are empty
    db = app_module.SessionLocal()
    try:
        cand_count = db.query(app_module.Candidate).count()
        if cand_count == 0:
            print("[+] Inserting sample candidate and job...")
            c1 = app_module.Candidate(
                name="John Doe",
                email="johndoe@example.com",
                skills="python,fastapi,sql,docker",
                experience_years=3,
                location="Remote",
            )
            j1 = app_module.Job(
                title="Backend Python Engineer",
                company="Tech Innovations Inc.",
                description="Looking for a Python/FastAPI developer with SQL experience.",
                required_skills="python,fastapi,sql",
                min_experience=2,
                location="Remote",
                apply_url="https://example.com/apply/123",
            )
            db.add_all([c1, j1])
            db.commit()
            print("[+] Sample records inserted successfully!")
        else:
            print(f"[+] Found {cand_count} existing candidates in MySQL.")
    finally:
        db.close()

    print("\n Setup complete! Open MySQL Workbench and run:")
    print("   USE referrals_db;")
    print("   SELECT * FROM candidates;")
    print("   SELECT * FROM jobs;")
    print("   SELECT * FROM email_logs;")

if __name__ == "__main__":
    setup()

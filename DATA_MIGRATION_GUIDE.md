# JobNex: MySQL to Supabase Migration Guide

This guide explains how to migrate existing data from MySQL Workbench to Supabase (PostgreSQL) and verify row counts before shutting down MySQL.

---

## 1. Execute Supabase Schema

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor** in the left sidebar.
3. Open the file [`supabase_schema.sql`](supabase_schema.sql) in this repository.
4. Copy and paste the entire script into the Supabase SQL Editor and click **Run**.
5. Verify that the following tables are created:
   - `public.profiles` (linked to `auth.users` with trigger `on_auth_user_created`)
   - `public.jobs`
   - `public.applications`
   - `public.resumes`
6. Verify that the private storage bucket `resumes` is created under **Storage**.

---

## 2. Export Data from MySQL Workbench

If you have existing data in MySQL Workbench that you wish to preserve:

1. Open **MySQL Workbench** and connect to your local database (`jobnex`).
2. In the **Navigator** pane, expand **Schemas** > `jobnex` > **Tables**.
3. For each table (`users`, `daily_job_matches` / `job_postings`, `applications`, `resumes`):
   - Right-click the table name and select **Table Data Export Wizard**.
   - Select all columns and click **Next**.
   - Choose **CSV** as the export format.
   - Choose a file destination (e.g. `users_export.csv`, `jobs_export.csv`, etc.).
   - Click **Next** > **Next** > **Finish**.

---

## 3. Import Data into Supabase

### Option A: Using Supabase Table Editor (Recommended for small to medium datasets)
1. In your Supabase Dashboard, click **Table Editor**.
2. Select the target table (e.g., `jobs`, `applications`, `resumes`).
3. Click **Insert** > **Import data from CSV**.
4. Drag and drop your exported CSV file.
5. Map any column names if needed (e.g. `exp_min`/`exp_max` to `experience`).
6. Click **Import**.

### Option B: Using `pgloader` (Automated CLI Migration)
If you have `pgloader` installed, you can migrate directly from MySQL to PostgreSQL:
```bash
pgloader mysql://root:password@127.0.0.1/jobnex postgresql://postgres:[YOUR-PASSWORD]@db.swqebafkntjlgjglylcr.supabase.co:5432/postgres
```

---

## 4. Verification

Before decommissioning MySQL, verify row counts match between MySQL and Supabase:

### In MySQL:
```sql
SELECT 'jobs' AS tbl, COUNT(*) FROM job_postings
UNION ALL
SELECT 'applications', COUNT(*) FROM applications
UNION ALL
SELECT 'resumes', COUNT(*) FROM resumes;
```

### In Supabase (SQL Editor):
```sql
SELECT 'jobs' AS tbl, COUNT(*) FROM public.jobs
UNION ALL
SELECT 'applications', COUNT(*) FROM public.applications
UNION ALL
SELECT 'resumes', COUNT(*) FROM public.resumes;
```

When row counts match, the migration is complete and the MySQL service can safely be deleted/stopped.


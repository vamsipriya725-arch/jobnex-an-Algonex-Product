-- ====================================================================
-- JobNex Complete Supabase Schema (PostgreSQL)
-- Run this script inside the Supabase SQL Editor
-- ====================================================================

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    role TEXT CHECK (role IN ('seeker', 'recruiter')) DEFAULT 'seeker',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. JOBS TABLE (Publicly readable job postings)
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT NOT NULL,
    work_mode TEXT DEFAULT 'Office',
    job_type TEXT DEFAULT 'Full-time',
    experience TEXT,
    salary TEXT DEFAULT 'Not disclosed',
    skills TEXT[] DEFAULT '{}',
    education TEXT,
    department TEXT,
    openings INT DEFAULT 1,
    description TEXT NOT NULL,
    apply_last_date TIMESTAMPTZ,
    apply_link TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. APPLICATIONS TABLE (User applications per job)
CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    job_title TEXT,
    company TEXT,
    status TEXT DEFAULT 'APPLIED',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, job_id)
);

-- 4. RESUMES TABLE (Uploaded resumes and extracted JSON)
CREATE TABLE IF NOT EXISTS public.resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    parsed_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ====================================================================
-- AUTOMATIC PROFILE TRIGGER ON SIGNUP
-- ====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, phone, role, avatar_url)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
        new.email,
        COALESCE(new.raw_user_meta_data->>'phone', ''),
        COALESCE(new.raw_user_meta_data->>'role', 'seeker'),
        COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', '')
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger execution on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Performance Indexes (Recommended by Supabase Postgres Best Practices)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON public.applications(job_id);
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON public.resumes(user_id);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = id);

-- 2. Jobs Policies: readable by everyone, writable by authenticated
DROP POLICY IF EXISTS "Jobs are readable by everyone" ON public.jobs;
CREATE POLICY "Jobs are readable by everyone"
    ON public.jobs FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can create jobs" ON public.jobs;
CREATE POLICY "Authenticated users can create jobs"
    ON public.jobs FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update jobs" ON public.jobs;
CREATE POLICY "Authenticated users can update jobs"
    ON public.jobs FOR UPDATE
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete jobs" ON public.jobs;
CREATE POLICY "Authenticated users can delete jobs"
    ON public.jobs FOR DELETE
    TO authenticated
    USING (true);

-- 3. Applications Policies
DROP POLICY IF EXISTS "Users can view own applications" ON public.applications;
CREATE POLICY "Users can view own applications"
    ON public.applications FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own applications" ON public.applications;
CREATE POLICY "Users can insert own applications"
    ON public.applications FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own applications" ON public.applications;
CREATE POLICY "Users can update own applications"
    ON public.applications FOR UPDATE
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own applications" ON public.applications;
CREATE POLICY "Users can delete own applications"
    ON public.applications FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

-- 4. Resumes Policies
DROP POLICY IF EXISTS "Users can view own resumes" ON public.resumes;
CREATE POLICY "Users can view own resumes"
    ON public.resumes FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own resumes" ON public.resumes;
CREATE POLICY "Users can insert own resumes"
    ON public.resumes FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own resumes" ON public.resumes;
CREATE POLICY "Users can update own resumes"
    ON public.resumes FOR UPDATE
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own resumes" ON public.resumes;
CREATE POLICY "Users can delete own resumes"
    ON public.resumes FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

-- ====================================================================
-- SUPABASE STORAGE: "resumes" Bucket Setup (Private)
-- ====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
DROP POLICY IF EXISTS "Users can upload resumes into their own folder" ON storage.objects;
CREATE POLICY "Users can upload resumes into their own folder"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'resumes' AND
        (SELECT auth.uid())::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users can view own uploaded resumes" ON storage.objects;
CREATE POLICY "Users can view own uploaded resumes"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'resumes' AND
        (SELECT auth.uid())::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users can update own uploaded resumes" ON storage.objects;
CREATE POLICY "Users can update own uploaded resumes"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'resumes' AND
        (SELECT auth.uid())::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users can delete own uploaded resumes" ON storage.objects;
CREATE POLICY "Users can delete own uploaded resumes"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'resumes' AND
        (SELECT auth.uid())::text = (storage.foldername(name))[1]
    );


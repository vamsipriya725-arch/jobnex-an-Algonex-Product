"""
JobNex Supabase Client Provider (FastAPI Backend)
Connects to Supabase Postgres, Auth, and Storage using SUPABASE_SERVICE_ROLE_KEY.
Service role key is kept strictly on the backend and NEVER exposed to frontend or Git.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load backend/.env and root .env
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project-id.supabase.co")

def _get_active_key() -> str:
    # Prefer secret / service role key if clean ascii and unmasked
    for key_name in ("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"):
        val = os.getenv(key_name, "").strip()
        if val and "•" not in val and all(ord(c) < 128 for c in val) and "your_" not in val:
            return val
    # Fallback to publishable / anon key
    for key_name in ("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"):
        val = os.getenv(key_name, "").strip()
        if val and "•" not in val and all(ord(c) < 128 for c in val) and "your_" not in val:
            return val
    return "sb_publishable_ax9iQjGlK5pP34biLoMcag_0egUp2qE"

SUPABASE_SERVICE_ROLE_KEY = _get_active_key()

_supabase_client = None


def get_supabase():
    """Returns singleton Supabase client, or None if credentials unconfigured."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    if not SUPABASE_URL or "your-project-id" in SUPABASE_URL:
        return None

    try:
        from supabase import create_client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        return _supabase_client
    except Exception as e:
        print(f"Warning: Supabase client initialization error: {e}")
        return None


def get_resume_signed_url(file_path: str, expires_in: int = 3600) -> str:
    """
    Generates a secure, temporary signed URL for a private resume file.
    Uses Supabase's active URL signing key on the storage cluster.
    """
    client = get_supabase()
    if not client:
        return ""
    try:
        res = client.storage.from_("resumes").create_signed_url(file_path, expires_in)
        if isinstance(res, dict):
            return res.get("signedURL") or res.get("signedUrl") or ""
        return getattr(res, "signed_url", "")
    except Exception as e:
        print(f"Error creating signed URL for resume '{file_path}': {e}")
        return ""


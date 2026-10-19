"""
tests/test_referral_emails.py — Feature tests for the Automatic Job Referral Email module.

Uses pytest-asyncio + httpx AsyncClient + SQLite in-memory.
The environment variables are patched BEFORE any app module is imported so that
database.py creates a SQLite engine instead of the PostgreSQL one.
"""
import os
# ── Override env vars before any app import ────────────────────────────────
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret-key-do-not-use-in-production"
os.environ["GEMINI_API_KEY"] = ""
os.environ["GMAIL_CLIENT_ID"] = ""
os.environ["GMAIL_CLIENT_SECRET"] = ""
os.environ["DEBUG"] = "false"

# ── Patch database.py pool kwargs (SQLite doesn't support pool_size) ───────
import unittest.mock as mock

# We patch create_async_engine to strip pool_size / max_overflow for SQLite
import sqlalchemy.ext.asyncio as _async_module
_orig_create = _async_module.create_async_engine


def _sqlite_safe_create(url, **kw):
    url_str = str(url)
    if "sqlite" in url_str:
        kw.pop("pool_size", None)
        kw.pop("max_overflow", None)
        from sqlalchemy.pool import StaticPool
        kw.setdefault("connect_args", {"check_same_thread": False})
        kw.setdefault("poolclass", StaticPool)
    return _orig_create(url, **kw)


_async_module.create_async_engine = _sqlite_safe_create

# ── Now import the app ──────────────────────────────────────────────────────
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core.database import Base, get_db
from main import app

# ── Build a separate in-memory test engine ─────────────────────────────────
from sqlalchemy.pool import StaticPool

TEST_ENGINE = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = async_sessionmaker(TEST_ENGINE, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestSession() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


# ── Session-scoped fixture: create all tables once ─────────────────────────
@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_tables():
    async with TEST_ENGINE.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with TEST_ENGINE.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ── Helpers ────────────────────────────────────────────────────────────────
async def register_and_login(
    client: AsyncClient,
    email: str,
    password: str = "TestPass123!",
    full_name: str = "Test User",
) -> str:
    resp = await client.post("/auth/register", json={
        "email": email,
        "password": password,
        "full_name": full_name,
    })
    if resp.status_code not in (200, 201):
        # Already registered — just login
        resp = await client.post("/auth/login", json={"email": email, "password": password})
    else:
        token = resp.json().get("access_token")
        if token:
            return token
    return resp.json()["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Tests ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_and_login(client: AsyncClient):
    """Users can register and receive a JWT."""
    resp = await client.post("/auth/register", json={
        "email": "alice_test@example.com",
        "password": "SecurePass1!",
        "full_name": "Alice",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == "alice_test@example.com"


@pytest.mark.asyncio
async def test_create_profile(client: AsyncClient):
    """Candidate can create a profile with skills."""
    token = await register_and_login(client, "bob_test@example.com")
    resp = await client.post("/profile", json={
        "title": "Backend Developer",
        "skills": ["Python", "FastAPI", "SQL"],
        "years_experience": 3,
        "location": "Bangalore",
    }, headers=auth(token))
    assert resp.status_code == 201
    assert "Python" in resp.json()["skills"]


@pytest.mark.asyncio
async def test_create_job(client: AsyncClient):
    """User can add a job opportunity."""
    token = await register_and_login(client, "carol_test@example.com")
    resp = await client.post("/jobs", json={
        "title": "Python Backend Developer",
        "company": "ABC Technologies",
        "required_skills": ["Python", "FastAPI", "Docker"],
        "experience_required": 2,
        "job_url": "https://example.com/job/123",
    }, headers=auth(token))
    assert resp.status_code == 201
    assert resp.json()["company"] == "ABC Technologies"


@pytest.mark.asyncio
async def test_job_match_score_attached(client: AsyncClient):
    """Jobs list includes a match score when candidate has a profile."""
    token = await register_and_login(client, "dave_test@example.com")
    h = auth(token)

    await client.post("/profile", json={
        "skills": ["Python", "FastAPI"],
        "years_experience": 3,
    }, headers=h)

    await client.post("/jobs", json={
        "title": "Python Dev",
        "company": "Corp",
        "required_skills": ["Python", "FastAPI", "Docker"],
        "experience_required": 2,
    }, headers=h)

    resp = await client.get("/jobs", headers=h)
    assert resp.status_code == 200
    jobs = resp.json()
    assert len(jobs) >= 1
    assert jobs[0]["match"] is not None
    assert jobs[0]["match"]["match_score"] > 0
    assert "Python" in jobs[0]["match"]["matched_skills"]
    assert "Docker" in jobs[0]["match"]["missing_skills"]


@pytest.mark.asyncio
async def test_create_referral_contact(client: AsyncClient):
    """User can add a referral contact."""
    token = await register_and_login(client, "eve_test@example.com")
    resp = await client.post("/referral-contacts", json={
        "name": "Rahul Sharma",
        "email": "rahul@abctech.com",
        "company": "ABC Technologies",
        "job_title": "Software Engineer",
        "relationship": "LinkedIn connection",
    }, headers=auth(token))
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Rahul Sharma"
    assert data["company"] == "ABC Technologies"
    assert data["relationship"] == "LinkedIn connection"


@pytest.mark.asyncio
async def test_create_referral_email_draft(client: AsyncClient):
    """Creating a referral email generates a DRAFT with subject and body."""
    token = await register_and_login(client, "frank_test@example.com")
    h = auth(token)

    await client.post("/profile", json={
        "title": "Backend Developer",
        "skills": ["Python", "FastAPI"],
        "years_experience": 2,
        "location": "Mumbai",
    }, headers=h)

    job_resp = await client.post("/jobs", json={
        "title": "Python Backend Developer",
        "company": "ABC Technologies",
        "required_skills": ["Python", "FastAPI"],
        "job_url": "https://example.com/job/1",
    }, headers=h)
    job_id = job_resp.json()["id"]

    contact_resp = await client.post("/referral-contacts", json={
        "name": "Rahul Kumar",
        "email": "rahul_test@abc.com",
        "company": "ABC Technologies",
        "job_title": "Senior Engineer",
        "relationship": "Former colleague",
    }, headers=h)
    contact_id = contact_resp.json()["id"]

    resp = await client.post(f"/jobs/{job_id}/referral-email", json={
        "job_id": job_id,
        "referral_contact_id": contact_id,
    }, headers=h)

    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "DRAFT"
    assert len(data["subject"]) > 0
    assert len(data["body"]) > 0
    assert "Rahul" in data["body"]


@pytest.mark.asyncio
async def test_edit_referral_email(client: AsyncClient):
    """User can edit the subject and body of a DRAFT."""
    token = await register_and_login(client, "grace_test@example.com")
    h = auth(token)

    await client.post("/profile", json={"skills": ["Python"], "years_experience": 1}, headers=h)
    job_resp = await client.post("/jobs", json={
        "title": "Dev", "company": "Corp", "required_skills": []
    }, headers=h)
    contact_resp = await client.post("/referral-contacts", json={
        "name": "Jane", "email": "jane_test@corp.com", "company": "Corp",
    }, headers=h)

    draft_resp = await client.post(f"/jobs/{job_resp.json()['id']}/referral-email", json={
        "job_id": job_resp.json()["id"],
        "referral_contact_id": contact_resp.json()["id"],
    }, headers=h)
    email_id = draft_resp.json()["id"]

    resp = await client.put(f"/referral-emails/{email_id}", json={
        "subject": "My Custom Subject",
        "body": "Hi Jane,\n\nCustom body.\n\nBest regards,\nGrace",
    }, headers=h)
    assert resp.status_code == 200
    assert resp.json()["subject"] == "My Custom Subject"
    assert resp.json()["status"] == "DRAFT"


@pytest.mark.asyncio
async def test_approve_referral_email(client: AsyncClient):
    """Approving a DRAFT changes its status to APPROVED."""
    token = await register_and_login(client, "henry_test@example.com")
    h = auth(token)

    await client.post("/profile", json={"skills": ["Java"], "years_experience": 5}, headers=h)
    job_resp = await client.post("/jobs", json={
        "title": "Java Dev", "company": "TechCorp", "required_skills": ["Java"]
    }, headers=h)
    contact_resp = await client.post("/referral-contacts", json={
        "name": "Tom", "email": "tom_test@techcorp.com", "company": "TechCorp",
    }, headers=h)

    draft_resp = await client.post(f"/jobs/{job_resp.json()['id']}/referral-email", json={
        "job_id": job_resp.json()["id"],
        "referral_contact_id": contact_resp.json()["id"],
    }, headers=h)
    email_id = draft_resp.json()["id"]

    resp = await client.post(f"/referral-emails/{email_id}/approve", headers=h)
    assert resp.status_code == 200
    assert resp.json()["status"] == "APPROVED"


@pytest.mark.asyncio
async def test_cancel_referral_email(client: AsyncClient):
    """Cancelling a DRAFT changes status to CANCELLED."""
    token = await register_and_login(client, "iris_test@example.com")
    h = auth(token)

    await client.post("/profile", json={"skills": ["React"], "years_experience": 2}, headers=h)
    job_resp = await client.post("/jobs", json={
        "title": "Frontend Dev", "company": "StartupXYZ", "required_skills": ["React"]
    }, headers=h)
    contact_resp = await client.post("/referral-contacts", json={
        "name": "Mike", "email": "mike_test@startup.com", "company": "StartupXYZ",
    }, headers=h)

    draft_resp = await client.post(f"/jobs/{job_resp.json()['id']}/referral-email", json={
        "job_id": job_resp.json()["id"],
        "referral_contact_id": contact_resp.json()["id"],
    }, headers=h)
    email_id = draft_resp.json()["id"]

    resp = await client.post(f"/referral-emails/{email_id}/cancel", headers=h)
    assert resp.status_code == 200
    assert resp.json()["status"] == "CANCELLED"


@pytest.mark.asyncio
async def test_duplicate_protection(client: AsyncClient):
    """Creating a second referral email for the same job+contact returns 409."""
    token = await register_and_login(client, "julia_test@example.com")
    h = auth(token)

    await client.post("/profile", json={"skills": ["Go"], "years_experience": 3}, headers=h)
    job_resp = await client.post("/jobs", json={
        "title": "Go Dev", "company": "Acme", "required_skills": ["Go"]
    }, headers=h)
    contact_resp = await client.post("/referral-contacts", json={
        "name": "Sara", "email": "sara_test@acme.com", "company": "Acme",
    }, headers=h)

    payload = {
        "job_id": job_resp.json()["id"],
        "referral_contact_id": contact_resp.json()["id"],
    }

    resp1 = await client.post(f"/jobs/{job_resp.json()['id']}/referral-email", json=payload, headers=h)
    assert resp1.status_code == 201

    resp2 = await client.post(f"/jobs/{job_resp.json()['id']}/referral-email", json=payload, headers=h)
    assert resp2.status_code == 409
    assert "already been created" in resp2.json()["detail"]


@pytest.mark.asyncio
async def test_unauthorized_access(client: AsyncClient):
    """User A cannot access User B's referral emails."""
    token_a = await register_and_login(client, "alice2_test@example.com")
    h_a = auth(token_a)

    await client.post("/profile", json={"skills": ["CSS"], "years_experience": 1}, headers=h_a)
    job_resp = await client.post("/jobs", json={
        "title": "Designer", "company": "DesignCo", "required_skills": []
    }, headers=h_a)
    contact_resp = await client.post("/referral-contacts", json={
        "name": "Leo", "email": "leo_test@design.com", "company": "DesignCo",
    }, headers=h_a)
    draft = await client.post(f"/jobs/{job_resp.json()['id']}/referral-email", json={
        "job_id": job_resp.json()["id"],
        "referral_contact_id": contact_resp.json()["id"],
    }, headers=h_a)
    email_id = draft.json()["id"]

    token_b = await register_and_login(client, "bob2_test@example.com")
    resp = await client.get(f"/referral-emails/{email_id}", headers=auth(token_b))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_send_without_gmail_connected_fails(client: AsyncClient):
    """Sending an email without connecting Gmail returns 400."""
    token = await register_and_login(client, "kyle_test@example.com")
    h = auth(token)

    await client.post("/profile", json={"skills": ["Ruby"], "years_experience": 4}, headers=h)
    job_resp = await client.post("/jobs", json={
        "title": "Ruby Dev", "company": "RubyShop", "required_skills": ["Ruby"]
    }, headers=h)
    contact_resp = await client.post("/referral-contacts", json={
        "name": "Nina", "email": "nina_test@rubyshop.com", "company": "RubyShop",
    }, headers=h)

    draft = await client.post(f"/jobs/{job_resp.json()['id']}/referral-email", json={
        "job_id": job_resp.json()["id"],
        "referral_contact_id": contact_resp.json()["id"],
    }, headers=h)
    email_id = draft.json()["id"]

    await client.post(f"/referral-emails/{email_id}/approve", headers=h)
    resp = await client.post(f"/referral-emails/{email_id}/send", headers=h)
    assert resp.status_code == 400
    assert "Gmail account not connected" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_invalid_referral_contact(client: AsyncClient):
    """Using a contact_id that belongs to another user returns 404."""
    token_a = await register_and_login(client, "liam_test@example.com")
    token_b = await register_and_login(client, "mia_test@example.com")

    # User B creates a contact
    contact_resp = await client.post("/referral-contacts", json={
        "name": "Ghost", "email": "ghost_test@corp.com", "company": "Corp",
    }, headers=auth(token_b))
    contact_id = contact_resp.json()["id"]

    # User A creates a job
    await client.post("/profile", json={"skills": ["PHP"], "years_experience": 1}, headers=auth(token_a))
    job_resp = await client.post("/jobs", json={
        "title": "PHP Dev", "company": "Corp", "required_skills": []
    }, headers=auth(token_a))

    # User A tries to use User B's contact — should 404
    resp = await client.post(f"/jobs/{job_resp.json()['id']}/referral-email", json={
        "job_id": job_resp.json()["id"],
        "referral_contact_id": contact_id,
    }, headers=auth(token_a))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_referral_emails(client: AsyncClient):
    """User can list their own referral emails."""
    token = await register_and_login(client, "nora_test@example.com")
    h = auth(token)

    await client.post("/profile", json={"skills": ["Kotlin"], "years_experience": 3}, headers=h)
    job_resp = await client.post("/jobs", json={
        "title": "Kotlin Dev", "company": "AndroidCo", "required_skills": ["Kotlin"]
    }, headers=h)
    contact_resp = await client.post("/referral-contacts", json={
        "name": "Owen", "email": "owen_test@android.com", "company": "AndroidCo",
    }, headers=h)

    await client.post(f"/jobs/{job_resp.json()['id']}/referral-email", json={
        "job_id": job_resp.json()["id"],
        "referral_contact_id": contact_resp.json()["id"],
    }, headers=h)

    resp = await client.get("/referral-emails", headers=h)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


# ── Auth & Login Robustness Tests ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_auth_login_case_insensitive(client: AsyncClient):
    """Email authentication is case-insensitive on login."""
    reg = await client.post("/auth/register", json={
        "email": "JaswanthUser@Example.COM",
        "password": "Password123!",
        "full_name": "Jaswanth Test",
    })
    assert reg.status_code == 201

    # Login with lowercase email
    login_resp = await client.post("/auth/login", json={
        "email": "jaswanthuser@example.com",
        "password": "Password123!",
    })
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()


@pytest.mark.asyncio
async def test_auth_login_oauth2_form(client: AsyncClient):
    """OAuth2 password form login on /auth/token works for Swagger UI."""
    await client.post("/auth/register", json={
        "email": "form_user@example.com",
        "password": "MySecretPassword1!",
        "full_name": "Form User",
    })

    form_resp = await client.post("/auth/token", data={
        "username": "form_user@example.com",
        "password": "MySecretPassword1!",
    })
    assert form_resp.status_code == 200
    assert "access_token" in form_resp.json()


@pytest.mark.asyncio
async def test_auth_login_invalid_credentials(client: AsyncClient):
    """Invalid password returns 401 with proper error details."""
    await client.post("/auth/register", json={
        "email": "correct_user@example.com",
        "password": "CorrectPassword1!",
        "full_name": "Correct User",
    })

    bad_resp = await client.post("/auth/login", json={
        "email": "correct_user@example.com",
        "password": "WrongPassword999!",
    })
    assert bad_resp.status_code == 401
    assert bad_resp.json()["detail"] == "Invalid email or password"


@pytest.mark.asyncio
async def test_auth_api_prefix_login(client: AsyncClient):
    """Routes mounted on /api/auth/login and /auth/login both work."""
    reg = await client.post("/api/auth/register", json={
        "email": "prefix_user@example.com",
        "password": "Password123!",
        "full_name": "Prefix User",
    })
    assert reg.status_code == 201

    login_resp = await client.post("/api/auth/login", json={
        "email": "prefix_user@example.com",
        "password": "Password123!",
    })
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()

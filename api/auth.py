"""
api/auth.py — Registration, login, token refresh, password change, and Gmail OAuth endpoints.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    verify_and_update_password,
    burn_dummy_verify,
    validate_password_strength,
    normalize_email,
    create_access_token,
    create_refresh_token,
    decode_token,
    REFRESH,
)
from app.core.rate_limit import login_limiter
from app.core.deps import get_current_user
from app.models.user import User
from app.models.gmail_token import GmailToken
from app.schemas.user import (
    UserCreate, UserLogin, UserOut, TokenOut, RefreshRequest, ChangePasswordRequest,
)
from app.services.gmail_service import get_authorization_url, exchange_code_for_tokens
from app.core.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _issue_tokens(user: User) -> TokenOut:
    claims = {"sub": str(user.id)}
    return TokenOut(
        access_token=create_access_token(claims),
        refresh_token=create_refresh_token(claims),
        user=UserOut.model_validate(user),
    )


def _invalid_credentials() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _locked_out(retry_after: int) -> HTTPException:
    minutes = max(1, (retry_after + 59) // 60)
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Too many failed login attempts. Try again in {minutes} minute(s).",
        headers={"Retry-After": str(retry_after)},
    )


async def _find_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(
        select(User).where(func.lower(User.email) == normalize_email(email))
    )
    return result.scalars().first()


async def _authenticate(db: AsyncSession, request: Request, email: str, password: str) -> User:
    """Shared login logic: lockout check, constant-time verify, active check."""
    email = normalize_email(email)
    key = f"{_client_ip(request)}|{email}"

    retry_after = login_limiter.retry_after(key)
    if retry_after:
        raise _locked_out(retry_after)

    user = await _find_user_by_email(db, email)

    if user:
        ok, new_hash = verify_and_update_password(password, user.hashed_password)
    else:
        burn_dummy_verify(password)   # same cost whether or not the email exists
        ok, new_hash = False, None

    if not ok:
        now_locked = login_limiter.record_failure(key)
        logger.warning("Failed login from %s (locked=%s)", _client_ip(request), now_locked)
        if now_locked:
            raise _locked_out(login_limiter.retry_after(key))
        raise _invalid_credentials()

    # Checked only after the password is correct, so it can't be used to probe accounts.
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    login_limiter.reset(key)
    if new_hash:  # transparently upgrade outdated password hashes
        user.hashed_password = new_hash
        await db.commit()
    return user


# ── Register / Login ──────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenOut, status_code=201)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user account."""
    if not payload.full_name:
        raise HTTPException(status_code=400, detail="Full name is required")

    problem = validate_password_strength(payload.password)
    if problem:
        raise HTTPException(status_code=400, detail=problem)

    if await _find_user_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:  # two simultaneous registrations for the same email
        await db.rollback()
        raise HTTPException(status_code=400, detail="Email already registered")
    await db.refresh(user)

    logger.info("New user registered: user_id=%s", user.id)
    return _issue_tokens(user)


@router.post("/login", response_model=TokenOut)
async def login(payload: UserLogin, request: Request, db: AsyncSession = Depends(get_db)):
    """Login with email and password (JSON)."""
    user = await _authenticate(db, request, payload.email, payload.password)
    logger.info("User logged in: user_id=%s", user.id)
    return _issue_tokens(user)


@router.post("/token", response_model=TokenOut)
async def login_form(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """OAuth2 password-flow login (form fields: username = email, password).
    Used by Swagger UI's "Authorize" button and standard OAuth2 clients."""
    user = await _authenticate(db, request, form.username, form.password)
    logger.info("User logged in (form): user_id=%s", user.id)
    return _issue_tokens(user)


@router.post("/refresh", response_model=TokenOut)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Exchange a valid refresh token for a new access + refresh token pair."""
    claims = decode_token(payload.refresh_token, expected_type=REFRESH)
    try:
        user_id = int(claims["sub"]) if claims else None
    except (KeyError, TypeError, ValueError):
        user_id = None
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _issue_tokens(user)


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return UserOut.model_validate(current_user)


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the password of the logged-in user."""
    key = f"pw|{current_user.id}"
    retry_after = login_limiter.retry_after(key)
    if retry_after:
        raise _locked_out(retry_after)

    if not verify_password(payload.current_password, current_user.hashed_password):
        if login_limiter.record_failure(key):
            raise _locked_out(login_limiter.retry_after(key))
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    problem = validate_password_strength(payload.new_password)
    if problem:
        raise HTTPException(status_code=400, detail=problem)
    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=400, detail="New password must be different from the current one")

    login_limiter.reset(key)
    current_user.hashed_password = hash_password(payload.new_password)
    await db.commit()
    logger.info("Password changed: user_id=%s", current_user.id)
    return {"success": True, "message": "Password updated"}


# ── Gmail OAuth ────────────────────────────────────────────────────────────────

@router.get("/gmail/connect")
async def gmail_connect(current_user: User = Depends(get_current_user)):
    """Return the Gmail OAuth authorization URL."""
    if not settings.GMAIL_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Gmail OAuth not configured")
    url = get_authorization_url(state=str(current_user.id))
    return {"authorization_url": url}


@router.get("/gmail/callback")
async def gmail_callback(
    code: str,
    state: str = "",
    db: AsyncSession = Depends(get_db),
):
    """
    Gmail OAuth callback — exchanges the authorization code for tokens
    and stores only the refresh_token in the database.
    """
    if not settings.GMAIL_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Gmail OAuth not configured")

    try:
        token_data = exchange_code_for_tokens(code)
    except Exception as exc:
        logger.error("Gmail OAuth token exchange failed: %s", exc)
        raise HTTPException(status_code=400, detail="Failed to exchange authorization code")

    # state is the user_id
    try:
        user_id = int(state)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    # Upsert GmailToken
    result = await db.execute(select(GmailToken).where(GmailToken.user_id == user_id))
    existing = result.scalar_one_or_none()

    if existing:
        existing.refresh_token = token_data["refresh_token"]
        existing.gmail_address = token_data["email"]
    else:
        db.add(GmailToken(
            user_id=user_id,
            refresh_token=token_data["refresh_token"],
            gmail_address=token_data["email"],
        ))

    await db.commit()
    logger.info("Gmail connected for user_id=%s gmail=%s", user_id, token_data["email"])

    # Redirect back to the frontend
    return RedirectResponse(url=f"{settings.FRONTEND_URL}/?gmail_connected=true")


@router.get("/gmail/status")
async def gmail_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check whether the current user has connected their Gmail account."""
    result = await db.execute(
        select(GmailToken).where(GmailToken.user_id == current_user.id)
    )
    token = result.scalar_one_or_none()
    return {
        "connected": token is not None,
        "gmail_address": token.gmail_address if token else None,
    }


@router.delete("/gmail/disconnect")
async def gmail_disconnect(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove stored Gmail OAuth tokens for the current user."""
    result = await db.execute(
        select(GmailToken).where(GmailToken.user_id == current_user.id)
    )
    token = result.scalar_one_or_none()
    if token:
        await db.delete(token)
        await db.commit()
    return {"success": True, "message": "Gmail disconnected"}

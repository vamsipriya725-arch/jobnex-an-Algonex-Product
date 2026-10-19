"""
api/auth.py — User registration, login, and Gmail OAuth endpoints.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, normalize_email
from app.core.deps import get_current_user
from app.models.user import User
from app.models.gmail_token import GmailToken
from app.schemas.user import UserCreate, UserLogin, UserOut, TokenOut
from app.services.gmail_service import get_authorization_url, exchange_code_for_tokens
from app.core.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


async def _login_user(email: str, password: str, db: AsyncSession) -> TokenOut:
    """Helper to authenticate user by email and password."""
    clean_email = normalize_email(email)
    result = await db.execute(
        select(User).where(func.lower(User.email) == clean_email)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    token = create_access_token({"sub": str(user.id)})
    logger.info("User logged in: user_id=%s", user.id)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/register", response_model=TokenOut, status_code=201)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user account."""
    clean_email = normalize_email(payload.email)
    result = await db.execute(
        select(User).where(func.lower(User.email) == clean_email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=clean_email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Email already registered")
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    logger.info("New user registered: user_id=%s email=%s", user.id, user.email)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    """Login with JSON payload (email and password)."""
    return await _login_user(payload.email, payload.password, db)


@router.post("/token", response_model=TokenOut)
async def login_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """OAuth2 password-flow login endpoint used by Swagger UI Authorize button."""
    return await _login_user(form_data.username, form_data.password, db)


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return UserOut.model_validate(current_user)


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

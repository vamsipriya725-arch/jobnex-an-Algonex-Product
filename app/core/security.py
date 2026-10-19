"""
core/security.py — JWT creation/verification, password hashing and password policy.
"""
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

if not settings.DEBUG and settings.SECRET_KEY == "change-me-in-production":
    logger.warning("SECRET_KEY is the insecure default — set a strong SECRET_KEY in .env")

# bcrypt 5.x has a breaking change with passlib 1.7.x (missing __about__).
# pbkdf2_sha256 is a pure-Python scheme — reliable on all platforms.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

ACCESS = "access"
REFRESH = "refresh"

# Hash used to burn the same CPU time when the email does not exist,
# so response time does not reveal which emails are registered.
_DUMMY_HASH = pwd_context.hash(secrets.token_urlsafe(16))


# ── Email ─────────────────────────────────────────────────────────────────────
def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


# ── Passwords ─────────────────────────────────────────────────────────────────
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128
_COMMON_PASSWORDS = {
    "password", "password1", "password123", "12345678", "123456789", "1234567890",
    "qwerty123", "qwertyuiop", "iloveyou", "admin123", "welcome1", "letmein123",
}


def validate_password_strength(plain: str) -> Optional[str]:
    """Return an error message if the password is unacceptable, else None."""
    if len(plain) < PASSWORD_MIN_LENGTH:
        return f"Password must be at least {PASSWORD_MIN_LENGTH} characters"
    if len(plain) > PASSWORD_MAX_LENGTH:
        return f"Password must be at most {PASSWORD_MAX_LENGTH} characters"
    if not any(c.isalpha() for c in plain) or not any(c.isdigit() for c in plain):
        return "Password must contain at least one letter and one number"
    if plain.lower() in _COMMON_PASSWORDS:
        return "Password is too common — choose a less guessable one"
    return None


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except ValueError:
        return False


def verify_and_update_password(plain: str, hashed: str) -> Tuple[bool, Optional[str]]:
    """Verify; also return a fresh hash if the stored one uses outdated settings."""
    try:
        return pwd_context.verify_and_update(plain, hashed)
    except ValueError:
        return False, None


def burn_dummy_verify(plain: str) -> None:
    """Spend the same time as a real verification (unknown-email path)."""
    pwd_context.verify(plain, _DUMMY_HASH)


# ── Tokens ────────────────────────────────────────────────────────────────────
def _create_token(data: dict, token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    to_encode = data.copy()
    to_encode.update({
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        "jti": uuid.uuid4().hex,
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    return _create_token(
        data, ACCESS, expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    return _create_token(
        data, REFRESH, expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )


def decode_token(token: str, expected_type: str = ACCESS) -> Optional[dict]:
    """Decode and validate a JWT. Returns None if invalid, expired or the wrong type.
    Tokens issued before the `type` claim existed are treated as access tokens."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
    if payload.get("type", ACCESS) != expected_type:
        return None
    return payload

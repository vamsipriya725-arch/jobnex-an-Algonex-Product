"""
Jobnex MVP-2 - Feature 9: Social Login (Google) + Direct Login
Run:  uvicorn main:app --reload
"""
import os
import urllib.parse
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.transport import requests as g_requests
from google.oauth2 import id_token as google_id_token
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import Boolean, Column, DateTime, Integer, String, create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

# ---------- Config ----------
SECRET_KEY = os.getenv("JWT_SECRET", "change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "60"))
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

# MySQL Workbench Connection Details
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = urllib.parse.quote_plus(os.getenv("DB_PASSWORD", "Algonex@123"))
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "jobnex")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
)
FRONTEND_ORIGINS = os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",")

# ---------- Database ----------
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    password_hash = Column(String, nullable=True)  # null for Google-only accounts
    google_sub = Column(String, unique=True, nullable=True)  # Google's stable user id
    auth_provider = Column(String, default="local")  # "local" | "google"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------- Schemas ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginIn(BaseModel):
    credential: str | None = None
    email: str | None = None
    name: str | None = None
    avatar: str | None = None
    google_sub: str | None = None


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str | None
    avatar_url: str | None
    auth_provider: str

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Security helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


bearer = HTTPBearer()


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


# ---------- App ----------
app = FastAPI(title="Jobnex Auth API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/auth/register", response_model=TokenOut, status_code=201)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    email = data.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(
        email=email,
        full_name=data.full_name,
        password_hash=hash_password(data.password),
        auth_provider="local",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenOut(access_token=create_access_token(user.id), user=user)


@app.post("/auth/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if not user or not user.password_hash or not verify_password(data.password, user.password_hash):
        # same message for both cases so attackers can't discover which emails exist
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")
    return TokenOut(access_token=create_access_token(user.id), user=user)


@app.post("/auth/google", response_model=TokenOut)
def google_login(data: GoogleLoginIn, db: Session = Depends(get_db)):
    info = None
    if data.credential:
        try:
            info = google_id_token.verify_oauth2_token(
                data.credential, g_requests.Request(), GOOGLE_CLIENT_ID
            )
        except Exception:
            try:
                import jwt as pyjwt
                info = pyjwt.decode(data.credential, options={"verify_signature": False})
            except Exception:
                pass

    email = ((info and info.get("email")) or data.email or "").lower()
    if not email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Valid Google email is required")

    sub = (info and info.get("sub")) or data.google_sub
    name = (info and (info.get("name") or info.get("given_name"))) or data.name or email.split("@")[0]
    picture = (info and info.get("picture")) or data.avatar

    user = None
    if sub:
        user = db.query(User).filter(User.google_sub == sub).first()
    if not user and email:
        user = db.query(User).filter(User.email == email).first()

    if not user:
        user = User(
            email=email,
            full_name=name,
            avatar_url=picture,
            google_sub=sub,
            auth_provider="google",
        )
        db.add(user)
    else:
        if sub: user.google_sub = sub
        if name: user.full_name = name
        if picture: user.avatar_url = picture
        user.auth_provider = "google"

    db.commit()
    db.refresh(user)

    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")
    return TokenOut(access_token=create_access_token(user.id), user=user)


@app.get("/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("login:app", host="127.0.0.1", port=8000, reload=True)
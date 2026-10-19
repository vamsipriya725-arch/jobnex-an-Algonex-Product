"""
services/gmail_service.py — Gmail OAuth 2.0 integration for sending referral emails.

Design decisions:
- Only the refresh_token is stored in the database; access tokens are always fetched fresh.
- Passwords are NEVER stored or used.
- OAuth scopes are minimal (gmail.send only).
"""
import base64
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import Flow

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]


def get_oauth_flow() -> Flow:
    """Return a configured OAuth 2.0 Flow object."""
    client_config = {
        "web": {
            "client_id": settings.GMAIL_CLIENT_ID,
            "client_secret": settings.GMAIL_CLIENT_SECRET,
            "redirect_uris": [settings.GMAIL_REDIRECT_URI],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    flow = Flow.from_client_config(client_config, scopes=SCOPES)
    flow.redirect_uri = settings.GMAIL_REDIRECT_URI
    return flow


def get_authorization_url(state: Optional[str] = None) -> str:
    """Generate the Google OAuth consent URL."""
    flow = get_oauth_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state or "",
    )
    return auth_url


def exchange_code_for_tokens(code: str) -> dict:
    """
    Exchange authorization code for tokens.
    Returns a dict with 'refresh_token' and 'email'.
    """
    flow = get_oauth_flow()
    flow.fetch_token(code=code)
    credentials = flow.credentials

    # Get the user's email address
    service = build("oauth2", "v2", credentials=credentials)
    user_info = service.userinfo().get().execute()

    return {
        "refresh_token": credentials.refresh_token,
        "email": user_info.get("email", ""),
    }


def _build_credentials(refresh_token: str) -> Credentials:
    """Create a Credentials object from a stored refresh token."""
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GMAIL_CLIENT_ID,
        client_secret=settings.GMAIL_CLIENT_SECRET,
        scopes=SCOPES,
    )
    creds.refresh(Request())
    return creds


def send_email_via_gmail(
    refresh_token: str,
    to_email: str,
    subject: str,
    body: str,
    from_name: str = "",
) -> str:
    """
    Send an email using the Gmail API.

    Args:
        refresh_token: The stored OAuth refresh token for the sender's Gmail account.
        to_email:      Recipient email address.
        subject:       Email subject line.
        body:          Plain-text email body.
        from_name:     Display name for the sender.

    Returns:
        The Gmail message ID (provider_message_id).

    Raises:
        Exception: On any Gmail API or auth failure.
    """
    credentials = _build_credentials(refresh_token)
    service = build("gmail", "v1", credentials=credentials)

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["To"] = to_email
    if from_name:
        message["From"] = from_name

    # Plain text version
    text_part = MIMEText(body, "plain")
    message.attach(text_part)

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    result = service.users().messages().send(
        userId="me", body={"raw": raw}
    ).execute()

    message_id = result.get("id", "")
    logger.info("Email sent via Gmail: message_id=%s to=%s", message_id, to_email)
    return message_id

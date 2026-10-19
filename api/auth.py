"""
Compatibility forwarder for app.api.auth
"""
from app.api.auth import (
    router,
    register,
    login,
    login_form,
    get_me,
    gmail_connect,
    gmail_callback,
    gmail_status,
    gmail_disconnect,
)

__all__ = [
    "router",
    "register",
    "login",
    "login_form",
    "get_me",
    "gmail_connect",
    "gmail_callback",
    "gmail_status",
    "gmail_disconnect",
]

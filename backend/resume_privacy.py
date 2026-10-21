import logging
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from database import get_connection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/privacy", tags=["privacy"])

# ---------------------------------------------------------------
# Resume lo personal info ni gurthinche patterns (regex).
# ---------------------------------------------------------------

# Email: ravi.kumar@gmail.com
EMAIL_RE = re.compile(
    r"""
    [A-Za-z0-9._%+-]+   # @ mundu username (letters, numbers, . _ % + -)
    @                   # @ symbol
    [A-Za-z0-9.-]+      # domain peru (gmail, company.co)
    \.                  # oka dot
    [A-Za-z]{2,}        # extension (com, in, org)
    """,
    re.VERBOSE,
)

# Phone: 9876543210, +91 98765 43210, 98765-43210
PHONE_RE = re.compile(
    r"""
    (?<!\d)                 # mundu inkoka digit undakudadu
    (?:\+?\d{1,3}[\s-]?)?   # optional country code (+91)
    \d(?:[\s-]?\d){8,10}    # 9 nundi 11 digits (madhyalo space leda - ok, last lo kaadu)
    (?!\d)                  # taruvata inkoka digit undakudadu
    """,
    re.VERBOSE,
)

# Link: https://linkedin.com/in/ravi, www.github.com/ravi
URL_RE = re.compile(
    r"""
    (?:https?://|www\.)     # http://, https:// leda www. tho modalavvali
    \S+                     # taruvata space ravadam varaku anni characters
    """,
    re.VERBOSE | re.IGNORECASE,
)


class RedactRequest(BaseModel):
    resume_text: str = Field(min_length=1)


def redact_text(text: str) -> str:
    """Text lo email, links, phone numbers ni hide chesi return chestundi.
    Idi main.py (save cheyyadaniki mundu) and /redact endpoint rendu vadathayi."""
    text = EMAIL_RE.sub("[EMAIL REMOVED]", text)
    text = URL_RE.sub("[LINK REMOVED]", text)
    text = PHONE_RE.sub("[PHONE REMOVED]", text)
    return text


@router.post("/redact")
def redact_resume(request: RedactRequest):
    """Resume text lo email, phone, links ni hide chesi return chestundi."""
    return {"redacted_text": redact_text(request.resume_text)}


@router.delete("/analysis/{analysis_id}")
def delete_analysis(analysis_id: int):
    """Saved analysis (resume text tho saha) database nundi delete chestundi."""
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            "DELETE FROM resume_analyzer WHERE Analysis_id = %s",
            (analysis_id,),
        )
        connection.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Analysis not found")

        return {"deleted": analysis_id}

    except HTTPException:
        raise
    except Exception as error:
        if connection is not None and connection.is_connected():
            connection.rollback()
        logger.exception("failed to delete analysis")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete analysis",
        ) from error

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()
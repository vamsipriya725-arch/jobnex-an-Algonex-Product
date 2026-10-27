import json
import logging
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from database import get_connection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/privacy", tags=["privacy"])


def init_privacy_vault(connection=None):
    """Ensures resume_privacy_vault table exists."""
    close_at_end = False
    if connection is None:
        connection = get_connection()
        close_at_end = True
    cursor = connection.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS resume_privacy_vault (
            vault_id INT AUTO_INCREMENT PRIMARY KEY,
            analysis_id INT NOT NULL UNIQUE,
            original_text LONGTEXT NOT NULL,
            pii_stats JSON,
            revealed_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    connection.commit()
    cursor.close()
    if close_at_end:
        connection.close()


def save_to_vault(connection, analysis_id: int, original_text: str, pii_stats: dict, user_email: str = None):
    """Securely stores original unredacted resume in privacy vault."""
    cursor = connection.cursor()
    cursor.execute("""
        INSERT INTO resume_privacy_vault (analysis_id, user_email, original_text, pii_stats)
        VALUES (%s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE user_email = VALUES(user_email), original_text = VALUES(original_text), pii_stats = VALUES(pii_stats)
    """, (analysis_id, user_email, original_text, json.dumps(pii_stats)))
    cursor.close()

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

# Link: https://linkedin.com/in/ravi, www.github.com/ravi, linkedin.com/in/ravi, github.com/ravi
URL_RE = re.compile(
    r"""
    (?<![\w@])              # not part of an email address
    (?:
        https?://\S+        # standard http:// or https:// URL
        |
        www\.\S+            # www.domain.com
        |
        (?:linkedin\.com|github\.com|gitlab\.com|portfolio\.[a-z]{2,}|bit\.ly|t\.co)/\S+
    )
    (?=[\s,;.)]|\Z)         # end at space, comma, semicolon, period, or string end
    """,
    re.VERBOSE | re.IGNORECASE,
)

# PIN / Postal code: 6-digit Indian PIN code (e.g. 500081)
PIN_RE = re.compile(r"\b[1-9][0-9]{5}\b")

# Government ID: PAN card (ABCDE1234F) & Aadhaar (1234 5678 9012)
PAN_RE = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b")
AADHAAR_RE = re.compile(r"\b\d{4}\s\d{4}\s\d{4}\b")


def count_pii_entities(text: str) -> dict:
    """Detects and tallies PII entities in the text."""
    if not text:
        return {"emails": 0, "phones": 0, "links": 0, "pins": 0, "ids": 0, "total": 0}
    emails = len(EMAIL_RE.findall(text))
    phones = len(PHONE_RE.findall(text))
    links = len(URL_RE.findall(text))
    pins = len(PIN_RE.findall(text))
    ids = len(PAN_RE.findall(text)) + len(AADHAAR_RE.findall(text))
    return {
        "emails": emails,
        "phones": phones,
        "links": links,
        "pins": pins,
        "government_ids": ids,
        "total": emails + phones + links + pins + ids,
    }


class RedactRequest(BaseModel):
    resume_text: str = Field(min_length=1)
    level: str = Field(default="standard")  # "standard" | "strict"


def redact_text(text: str, level: str = "standard") -> str:
    """Text lo email, links, phone numbers (and pin/ids in strict mode) hide chesi return chestundi.
    Idi main.py (save cheyyadaniki mundu) and /redact endpoint rendu vadathayi."""
    if not text:
        return text
    text = EMAIL_RE.sub("[EMAIL REMOVED]", text)
    text = URL_RE.sub("[LINK REMOVED]", text)
    text = PHONE_RE.sub("[PHONE REMOVED]", text)
    if level == "strict":
        text = PIN_RE.sub("[LOCATION REMOVED]", text)
        text = PAN_RE.sub("[ID REMOVED]", text)
        text = AADHAAR_RE.sub("[ID REMOVED]", text)
    return text


@router.post("/redact")
def redact_resume(request: RedactRequest):
    """Resume text lo email, phone, links ni hide chesi return chestundi."""
    return {
        "redacted_text": redact_text(request.resume_text, level=request.level),
        "pii_stats": count_pii_entities(request.resume_text),
    }


@router.post("/reveal/{analysis_id}")
@router.get("/reveal/{analysis_id}")
def reveal_candidate_details(analysis_id: int):
    """Authorized recruiter/admin endpoint to unlock and reveal original candidate contact details."""
    connection = None
    cursor = None
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT analysis_id, original_text, pii_stats, revealed_at, created_at FROM resume_privacy_vault WHERE analysis_id = %s",
            (analysis_id,)
        )
        row = cursor.fetchone()
        if not row:
            # Fall back to resume_analyzer if not in vault
            cursor.execute("SELECT Analysis_Id as analysis_id, resume_text as original_text FROM resume_analyzer WHERE Analysis_Id = %s", (analysis_id,))
            fallback_row = cursor.fetchone()
            if not fallback_row:
                raise HTTPException(status_code=404, detail="Analysis record not found")
            return {
                "analysis_id": fallback_row["analysis_id"],
                "original_text": fallback_row["original_text"],
                "status": "unlocked",
                "message": "Direct record retrieved from analyzer storage."
            }

        # Update revealed_at timestamp for audit logging
        cursor.execute("UPDATE resume_privacy_vault SET revealed_at = NOW() WHERE analysis_id = %s", (analysis_id,))
        connection.commit()

        pii_stats = row["pii_stats"]
        if isinstance(pii_stats, str):
            pii_stats = json.loads(pii_stats)

        return {
            "analysis_id": row["analysis_id"],
            "original_text": row["original_text"],
            "pii_stats": pii_stats,
            "status": "unlocked",
            "revealed_at": row["revealed_at"].isoformat() if row.get("revealed_at") else None,
            "message": "Candidate contact information unlocked successfully for authorized recruitment."
        }
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Failed to reveal candidate details")
        raise HTTPException(status_code=500, detail="Failed to reveal candidate details") from error
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


@router.delete("/analysis/{analysis_id}")
def delete_analysis(analysis_id: int):
    """Saved analysis (resume text tho saha) database nundi delete chestundi."""
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        # Delete from secure vault first
        try:
            cursor.execute("DELETE FROM resume_privacy_vault WHERE analysis_id = %s", (analysis_id,))
        except Exception:
            pass

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
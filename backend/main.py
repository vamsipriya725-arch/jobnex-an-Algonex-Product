                                                                                                     

# changed main.py

#main.py                                                                                                      
# pyrefly: ignore [missing-import]
import sys
from pathlib import Path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# pyrefly: ignore[missing-import]
from suggestions_resources import create_router      # add with the other imports
             # add right after the CORS middleware
# Add Backend folder to sys.path so sibling imports work seamlessly

# pyrefly: ignore[missing-import]
from fastapi import FastAPI, HTTPException
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field, field_validator
# pyrefly: ignore[missing-import]
from database import get_connection
# pyrefly: ignore[missing-import]
from analyzer import analyze_resume, analyse_resume
import json
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
import logging
logging.basicConfig(level=logging.INFO)
logger=logging.getLogger(__name__)

app = FastAPI()
# pyrefly: ignore[missing-import]
from interview_prep import router as interview_prep_router
app.include_router(interview_prep_router)
# pyrefly: ignore[missing-import]
from chatbot_assistant import create_router as create_chat_router
app.include_router(create_chat_router())
# pyrefly: ignore[missing-import]
from application_dashboard import create_router as create_dashboard_router
try:
    app.include_router(create_dashboard_router())
except Exception as e:
    logger.warning("Could not connect to MySQL for dashboard router: %s", e)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "*"
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(create_router())
class analyseRequest(BaseModel):
    resume_text: str=Field(min_length=50)
    jd_text: str=Field(min_length=50)
    @field_validator("resume_text","jd_text")
    @classmethod
    def not_blank_valid(cls,value):
        if not value.strip():
            raise ValueError("Fill without spaces")
        return value 

@app.get("/")
def home():
    return {
        "message": "Resume analyser Backend is Running"
    }

# pyrefly: ignore[missing-import]
from fastapi.responses import Response

@app.get("/favicon.ico", include_in_schema=False)
@app.get("/favicon.png", include_in_schema=False)
def favicon():
    return Response(status_code=204)




@app.post("/api/analyse")
def analyse(request: analyseRequest):

    result = analyse_resume(request.resume_text,request.jd_text)
    print(result)
    connection = None
    cursor = None
    analysis_id = None

    try:
        connection = get_connection()
        cursor = connection.cursor()
        query = """
            INSERT INTO resume_analyzer (resume_text, jd_text, matched_skills, missing_skills, matched_score, suggestions)
            VALUES (%s, %s, %s, %s, %s, %s)
        """

        cursor.execute(
            query, (
                request.resume_text,
                request.jd_text,
                json.dumps(result["matched_skills"]),
                json.dumps(result["missing_skills"]),
                result["matched_score"],
                json.dumps(result["suggestions"])
            )
        )

        connection.commit()
        analysis_id = cursor.lastrowid

        
        
    except Exception as error:
        if connection is not None and connection.is_connected():
            connection.rollback()
        logger.exception("Failed to save resume analysis")
        raise HTTPException(
            status_code=500,
            detail="Failed to save analysis"
        ) from error

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()
    return {
        "Analysis_Id": analysis_id,
        **result
    }

# Backend API: Retrieve analysis history
@app.get("/api/analyses")
def get_analyses():
    connection = None
    cursor = None

    try:
        # Connect to MySQL
        connection = get_connection()

        # Create a cursor that returns dictionary rows
        cursor = connection.cursor(dictionary=True)

        # Fetch the latest 20 analyses
        query = """SELECT
                Analysis_id,
                matched_score,
                matched_skills,
                missing_skills,
                created_At
            FROM resume_analyzer
            ORDER BY Analysis_id DESC
            LIMIT 3"""

        cursor.execute(query)
        analyses = cursor.fetchall()

        for i in analyses:
            for field in ("matched_skills", "missing_skills"):
                value = i[field]

                if isinstance(value, str):
                    i[field] = json.loads(value)

        return {"analyses": analyses}

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve analyses"
        ) from error

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()


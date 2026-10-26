"""
JobNex Server Runner
Runs the FastAPI application on http://127.0.0.1:8000
"""
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import uvicorn
from main import app

if __name__ == "__main__":
    print("=" * 60)
    print("[*] Starting JobNex FastAPI Backend on http://127.0.0.1:8000")
    print("[*] Documentation: http://127.0.0.1:8000/docs")
    print("[*] ATS Resume API: http://127.0.0.1:8000/ats-resume/health")
    print("=" * 60)
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")

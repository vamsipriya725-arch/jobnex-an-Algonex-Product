"""
JobNex Root Application Entry Point
Forwards ASGI app from backend.main so commands like:
  python -m uvicorn main:app --reload --port 8000
or
  python main.py
work directly from the repository root.
"""
import sys
from pathlib import Path

# Add backend directory and root directory to sys.path
root_dir = Path(__file__).resolve().parent
backend_dir = root_dir / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.main import app

if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("[*] Starting JobNex FastAPI Backend on http://127.0.0.1:8000")
    print("[*] Documentation: http://127.0.0.1:8000/docs")
    print("=" * 60)
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)


"""
JobNex Unified Launcher
Starts both the FastAPI Backend (port 8000) and the Frontend Server (port 3000)
without altering any backend or frontend application logic.
"""
import os
import sys
import time
import subprocess
import signal

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "Frontend")

if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def main():
    print("=" * 60)
    print("[JobNex] Starting Integrated Environment")
    print("=" * 60)
    print(">> Backend:   http://127.0.0.1:8000 (FastAPI API & Docs)")
    print(">> Frontend:  http://localhost:3000 (Career Portal & Auth)")
    print(">> AI Agent:  http://127.0.0.1:8000/frontend/pages/ai-assistant.html")
    print("=" * 60)

    os.environ["DISABLE_SQLALCHEMY_CEXT"] = "1"

    venv_python = os.path.join(ROOT_DIR, ".venv", "Scripts", "python.exe")
    python_exec = venv_python if os.path.exists(venv_python) else sys.executable

    # 1. Start FastAPI Backend via uvicorn
    backend_cmd = [
        python_exec, "-m", "uvicorn",
        "main:app",
        "--host", "127.0.0.1",
        "--port", "8000"
    ]
    backend_process = subprocess.Popen(
        backend_cmd,
        cwd=BACKEND_DIR
    )

    # 2. Start Frontend server on port 3000
    frontend_process = None
    portal_dir = os.path.join(FRONTEND_DIR, "frontend")
    serve_target = portal_dir if os.path.exists(portal_dir) else FRONTEND_DIR
    frontend_cmd = [python_exec, "-m", "http.server", "3000", "--directory", serve_target]
    try:
        frontend_process = subprocess.Popen(
            frontend_cmd,
            cwd=ROOT_DIR
        )
    except Exception as e:
        print(f"[Warning] Could not start Frontend server ({e}). Backend running standalone.")

    print("\n[OK] System active! Press Ctrl+C to terminate both servers cleanly.\n")

    def shutdown(sig, frame):
        print("\n[JobNex] Shutting down servers...")
        if frontend_process:
            frontend_process.terminate()
        if backend_process:
            backend_process.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        while True:
            time.sleep(1)
            # Check if backend crashed
            if backend_process.poll() is not None:
                print(f"Backend exited with code {backend_process.returncode}")
                break
    except KeyboardInterrupt:
        shutdown(None, None)

if __name__ == "__main__":
    main()

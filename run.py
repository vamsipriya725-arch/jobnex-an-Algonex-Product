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

def main():
    print("=" * 60)
    print("🚀 Starting JobNex Integrated Environment")
    print("=" * 60)
    print("📡 Backend:   http://127.0.0.1:8000 (FastAPI API & Docs)")
    print("📡 Frontend:  http://localhost:3000 (Career Portal & Auth)")
    print("=" * 60)

    # 1. Start FastAPI Backend via uvicorn
    backend_cmd = [
        sys.executable, "-m", "uvicorn",
        "main:app",
        "--host", "127.0.0.1",
        "--port", "8000"
    ]
    backend_process = subprocess.Popen(
        backend_cmd,
        cwd=BACKEND_DIR
    )

    # 2. Start Frontend dev server via node
    frontend_process = None
    serve_js = os.path.join(FRONTEND_DIR, "serve.js")
    if os.path.exists(serve_js):
        frontend_cmd = ["node", "serve.js"]
        try:
            frontend_process = subprocess.Popen(
                frontend_cmd,
                cwd=FRONTEND_DIR
            )
        except Exception as e:
            print(f"⚠️ Could not start Node frontend server ({e}). Backend running standalone.")

    print("\n✅ System active! Press Ctrl+C to terminate both servers cleanly.\n")

    def shutdown(sig, frame):
        print("\n🛑 Shutting down JobNex servers...")
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

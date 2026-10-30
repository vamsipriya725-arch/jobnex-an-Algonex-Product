import os
from pathlib import Path
import mysql.connector

try:
    from dotenv import load_dotenv
    backend_env = Path(__file__).resolve().parent / ".env"
    root_env = Path(__file__).resolve().parent.parent / ".env"
    if backend_env.exists():
        load_dotenv(dotenv_path=backend_env)
    if root_env.exists():
        load_dotenv(dotenv_path=root_env)
    load_dotenv()
except ImportError:
    pass


def get_connection():
    host = os.getenv("DB_HOST") or os.getenv("MYSQL_HOST") or "127.0.0.1"
    port = int(os.getenv("DB_PORT") or os.getenv("MYSQL_PORT") or 3306)
    user = os.getenv("DB_USER") or os.getenv("MYSQL_USER") or "root"
    password = os.getenv("DB_PASSWORD") or os.getenv("MYSQL_PASSWORD") or "Algonex@2003"
    database = os.getenv("DB_NAME") or os.getenv("MYSQL_DATABASE") or "jobnex"
    timeout = int(os.getenv("DB_CONNECT_TIMEOUT", "3"))
    return mysql.connector.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        connection_timeout=timeout,
        use_pure=True,
    )

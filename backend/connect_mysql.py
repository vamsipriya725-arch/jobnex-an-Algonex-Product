#!/usr/bin/env python3
"""
JobNex Interactive MySQL Console
Connects directly to the local MySQL database using project configuration.
Usage:
    python connect_mysql.py
    python connect_mysql.py "SELECT * FROM user_course_recommendations LIMIT 5;"
"""

import sys
from database import get_connection

def run_query(cursor, query):
    try:
        cursor.execute(query)
        if cursor.description:
            rows = cursor.fetchall()
            if not rows:
                print("(0 rows returned)")
                return
            headers = list(rows[0].keys())
            # Calculate column widths
            col_widths = {h: max(len(str(h)), max(len(str(r.get(h, ""))) for r in rows)) for h in headers}
            # Limit max width for readability
            col_widths = {h: min(w, 45) for h, w in col_widths.items()}
            
            # Print header
            header_line = " | ".join(f"{h:<{col_widths[h]}}" for h in headers)
            sep_line = "-+-".join("-" * col_widths[h] for h in headers)
            print(header_line)
            print(sep_line)
            for r in rows:
                row_line = " | ".join(
                    f"{str(r.get(h, ''))[:col_widths[h]]:<{col_widths[h]}}" for h in headers
                )
                print(row_line)
            print(f"\n({len(rows)} rows)")
        else:
            print("Query OK, statement executed successfully.")
    except Exception as e:
        print(f"Error: {e}")

def main():
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
    except Exception as e:
        print(f"Failed to connect to MySQL: {e}")
        sys.exit(1)

    # If query passed as CLI argument, execute and exit
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        run_query(cursor, query)
        cursor.close()
        conn.close()
        return

    print("=" * 75)
    print(" JobNex MySQL Interactive Console")
    print(" Database: jobnex | Host: 127.0.0.1:3306")
    print(" Commands: 'tables', 'desc <table_name>', 'exit' or any valid SQL")
    print("=" * 75)

    cursor.execute("SHOW TABLES")
    tables = [list(r.values())[0] for r in cursor.fetchall()]
    print(f"Available Tables ({len(tables)}):")
    print("  " + ", ".join(tables) + "\n")

    try:
        while True:
            try:
                line = input("mysql [jobnex]> ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\nGoodbye!")
                break

            if not line:
                continue
            if line.lower() in ("exit", "quit", "\\q"):
                print("Disconnected.")
                break
            if line.lower() == "tables":
                line = "SHOW TABLES;"
            elif line.lower().startswith("desc ") and not line.endswith(";"):
                line = f"DESCRIBE {line[5:].strip()};"

            run_query(cursor, line)
            conn.commit()
            print()
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    main()

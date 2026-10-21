#insert_test.py                                                                                                               
from database import get_connection
connection = None
cursor = None

try:
    connection = get_connection()
    cursor = connection.cursor()

    resume = "Python developer with Python, SQL and React skills."
    jd_text= "Looking for a Python developer with SQL and FastAPI."

    query = """
        INSERT INTO resume_analyzer (resume_text, jd_text)
        VALUES (%s, %s)
    """

    cursor.execute(query, (resume, jd_text))
    connection.commit()

    print("Analysis saved successfully!")
    print("Record ID:", cursor.lastrowid)

except Exception as error:
    if connection is not None:
        connection.rollback()
    print("Error:", error)

finally:
    if cursor is not None:
        cursor.close()

    if connection is not None:
        connection.close()
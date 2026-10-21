# from database import get_connection

# connection = None
# cursor = None

# try:
#     connection = get_connection()
#     cursor = connection.cursor()

#     resume = "Python developer with Python, SQL and React skills."
#     jd_text= "Looking for a Python developer with SQL and FastAPI."

#     query = """
#         INSERT INTO resume_analyzer (resume_text, jd_text)
#         VALUES (%s, %s)
#     """

#     cursor.execute(query, (resume, jd_text))
#     connection.commit()

#     print("Analysis saved successfully!")
#     print("Record ID:", cursor.lastrowid)

# except Exception as error:
#     if connection is not None:
#         connection.rollback()
#     print("Error:", error)

# finally:
#     if cursor is not None:
#         cursor.close()

#     if connection is not None:
#         connection.close()
import json
from database import get_connection

connection = None
cursor = None

try:
    connection = get_connection()
    cursor = connection.cursor()

    # 1) filter_checks
    check_query = """
        INSERT INTO filter_checks
            (resume_text, jd_text, resume_years, required_years, experience_meets,
             resume_certifications, required_certifications, missing_certifications,
             overall_match)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    cursor.execute(check_query, (
        "Java developer with 5 years of experience in Spring Boot and MySQL. "
        "Certified: AWS Certified Solutions Architect.",
        "Backend developer with minimum 3 years of experience in Java. "
        "Required certification: AWS Certified Solutions Architect.",
        5.0,
        3.0,
        True,
        json.dumps(["AWS Certified Solutions Architect"]),
        json.dumps(["AWS Certified Solutions Architect"]),
        json.dumps([]),
        True,
    ))
    print("filter_checks saved! Check_id:", cursor.lastrowid)

    # 2) filter_runs
    run_query = """
        INSERT INTO filter_runs
            (min_experience_years, required_certifications, total_checked,
             matched_count, matched_ids)
        VALUES (%s, %s, %s, %s, %s)
    """

    cursor.execute(run_query, (
        3.0,
        json.dumps(["AWS Certified Solutions Architect"]),
        28,
        1,
        json.dumps([1]),
    ))
    print("filter_runs saved! Run_id:", cursor.lastrowid)

    connection.commit()
    print("Committed successfully!")

except Exception as error:
    if connection is not None:
        connection.rollback()
    print("Error:", error)

finally:
    if cursor is not None:
        cursor.close()

    if connection is not None:
        connection.close()
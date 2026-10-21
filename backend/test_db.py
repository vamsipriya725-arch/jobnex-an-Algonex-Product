from database import get_connection

def test_connection():
    connection = None
    try:
        connection = get_connection()
        if connection.is_connected():
            print("MySQL connection successful!")
    except Exception as error:
        print("MySQL connection failed:", error)
    finally:
        if connection is not None and connection.is_connected():
            connection.close()


if __name__ == "__main__":
    test_connection()
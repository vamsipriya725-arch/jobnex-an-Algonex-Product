import mysql.connector 

def get_connection():
    try:
        return mysql.connector.connect (
            host = "127.0.0.1",
            port = '3306',
            user = 'root',
            password = 'Algonex@2003',
            database = 'jobnex'
        )
    except mysql.connector.Error:
        return mysql.connector.connect (
            host = "127.0.0.1",
            port = '3306',
            user = 'root',
            password = 'Algonex@123',
            database = 'jobnex'
        )
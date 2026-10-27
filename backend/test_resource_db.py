"""
test_resource_db.py
Comprehensive unit test suite for resource_db.py course recommendation persistence.
Uses isolated in-memory SQLite to verify all persistence, upsert, query, and status operations.
"""
import sqlite3
import unittest
from resource_db import (
    create_course_recommendations_table,
    upsert_course_recommendations,
    get_user_course_recommendations,
    update_course_status,
    fetch_missing_skills_from_db,
)


class InMemoryDB:
    def __init__(self):
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row

    def get_connection(self):
        return self.conn


class TestResourceDB(unittest.TestCase):
    def setUp(self):
        self.db = InMemoryDB()
        self.factory = self.db.get_connection

    def tearDown(self):
        try:
            self.db.conn.close()
        except Exception:
            pass

    def test_create_table(self):
        success = create_course_recommendations_table(self.factory)
        self.assertTrue(success)

        cursor = self.db.conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='user_course_recommendations'")
        row = cursor.fetchone()
        self.assertIsNotNone(row)

    def test_upsert_and_query_courses(self):
        sample_courses = [
            {
                "skill": "Python",
                "title": "Complete Python Bootcamp: Go from zero to hero",
                "provider": "Udemy",
                "url": "https://www.udemy.com/course/complete-python-bootcamp/",
                "rating": 4.8,
                "reviewCount": 15000,
                "duration": "22h",
                "badgeColor": "bg-purple-50 text-purple-700 border-purple-200",
                "skillsTargeted": ["Python", "OOP"],
                "status": "recommended",
                "aiTip": "Start with core syntax and data structures.",
            },
            {
                "skill": "Docker",
                "title": "Docker for Developers",
                "provider": "Coursera",
                "url": "https://www.coursera.org/learn/docker",
                "rating": 4.9,
                "reviewCount": 8500,
                "duration": "10 weeks",
                "badgeColor": "bg-blue-50 text-blue-700 border-blue-200",
                "skillsTargeted": ["Docker", "Containers"],
                "status": "recommended",
                "aiTip": "Learn containerizing microservices.",
            },
        ]

        # 1. Insert courses
        count = upsert_course_recommendations("user-42", sample_courses, self.factory)
        self.assertEqual(count, 2)

        # 2. Query all courses for user
        saved = get_user_course_recommendations("user-42", connection_factory=self.factory)
        self.assertEqual(len(saved), 2)
        self.assertEqual(saved[0]["userId"], "user-42")

        # 3. Query filtered by skill
        python_courses = get_user_course_recommendations("user-42", skill="Python", connection_factory=self.factory)
        self.assertEqual(len(python_courses), 1)
        self.assertEqual(python_courses[0]["skill"], "Python")

    def test_upsert_updates_existing_course(self):
        initial = [
            {
                "skill": "AWS",
                "title": "AWS Cloud Practitioner Basics",
                "provider": "Coursera",
                "url": "https://www.coursera.org/learn/aws-cloud-basics",
                "rating": 4.6,
                "duration": "6 weeks",
                "status": "recommended",
                "aiTip": "Initial tip",
            }
        ]
        upsert_course_recommendations("user-99", initial, self.factory)

        # Upsert with updated title, higher rating, updated tip
        updated = [
            {
                "skill": "AWS",
                "title": "AWS Cloud Practitioner Complete (2026)",
                "provider": "Coursera",
                "url": "https://www.coursera.org/learn/aws-cloud-basics",
                "rating": 4.9,
                "duration": "8 weeks",
                "status": "recommended",
                "aiTip": "Updated tip for 2026",
            }
        ]
        upsert_course_recommendations("user-99", updated, self.factory)

        saved = get_user_course_recommendations("user-99", connection_factory=self.factory)
        # Should still be 1 record, not 2
        self.assertEqual(len(saved), 1)
        self.assertEqual(saved[0]["title"], "AWS Cloud Practitioner Complete (2026)")
        self.assertEqual(saved[0]["rating"], 4.9)
        self.assertEqual(saved[0]["duration"], "8 weeks")
        self.assertEqual(saved[0]["aiTip"], "Updated tip for 2026")

    def test_update_course_status(self):
        course = [
            {
                "skill": "Kubernetes",
                "title": "Kubernetes in Action",
                "provider": "Coursera",
                "url": "https://www.coursera.org/learn/kubernetes",
                "status": "recommended",
            }
        ]
        upsert_course_recommendations("user-1", course, self.factory)
        courses = get_user_course_recommendations("user-1", connection_factory=self.factory)
        course_id = int(courses[0]["id"])

        # Update status to in_progress
        updated = update_course_status("user-1", course_id, "in_progress", self.factory)
        self.assertIsNotNone(updated)
        self.assertEqual(updated["status"], "in_progress")

        # Verify querying by status
        in_progress_courses = get_user_course_recommendations("user-1", status="in_progress", connection_factory=self.factory)
        self.assertEqual(len(in_progress_courses), 1)
        self.assertEqual(in_progress_courses[0]["id"], str(course_id))

    def test_fetch_missing_skills_from_db(self):
        # Setup mock resume_analyzer table in SQLite
        cursor = self.db.conn.cursor()
        cursor.execute("CREATE TABLE resume_analyzer (Analysis_Id INTEGER PRIMARY KEY, missing_skills TEXT)")
        cursor.execute("INSERT INTO resume_analyzer VALUES (1, '[\"sql\", \"docker\"]')")
        cursor.execute("INSERT INTO resume_analyzer VALUES (2, NULL)")
        self.db.conn.commit()

        val1 = fetch_missing_skills_from_db(1, self.factory)
        self.assertEqual(val1, '["sql", "docker"]')

        val2 = fetch_missing_skills_from_db(2, self.factory)
        self.assertEqual(val2, "")

        val3 = fetch_missing_skills_from_db(999, self.factory)
        self.assertIsNone(val3)


if __name__ == "__main__":
    unittest.main()

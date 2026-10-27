"""
test_skill_gap_dynamic.py
End-to-End verification of dynamic Skill Gap Course Recommendations:
  1. Calls router handler directly with missing skills and user_id.
  2. Verifies dynamic courses are generated with required schema.
  3. Verifies persistence into MySQL user_course_recommendations table.
  4. Tests upsert behavior when same skill/course is sent again.
  5. Tests change_course_status handler.
  6. Tests empty state handling.
"""
import unittest
from suggestions_resources import create_router, format_course_item
import resource_db


class TestSkillGapDynamic(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        resource_db.create_course_recommendations_table()
        cls.router = create_router()

    def test_dynamic_recommendation_and_persistence(self):
        # Find the route handlers from the router
        suggest_handler = None
        user_courses_handler = None
        status_handler = None

        for route in self.router.routes:
            if getattr(route, "path", "") == "/api/resources" and "POST" in getattr(route, "methods", set()):
                suggest_handler = route.endpoint
            elif getattr(route, "path", "") == "/api/resources/user/{user_id}":
                user_courses_handler = route.endpoint
            elif getattr(route, "path", "") == "/api/resources/courses/{course_id}/status":
                status_handler = route.endpoint

        self.assertIsNotNone(suggest_handler, "suggest handler found")
        self.assertIsNotNone(user_courses_handler, "user courses handler found")
        self.assertIsNotNone(status_handler, "status handler found")

        # 1. Trigger dynamic recommendation
        # Create request object via the pydantic model in the endpoint signature
        params = suggest_handler.__annotations__["request"]
        req = params(
            user_id="test-user-dynamic",
            missing_skills=["Deep Learning", "Docker"],
            job_id="job-test",
            use_ai=False,
            persist=True,
        )

        res = suggest_handler(req)
        self.assertTrue(res.get("success"))
        self.assertEqual(res.get("user_id"), "test-user-dynamic")
        courses = res.get("courses", [])
        self.assertGreater(len(courses), 0)

        first = courses[0]
        self.assertIn("title", first)
        self.assertIn("provider", first)
        self.assertIn("url", first)
        self.assertIn("status", first)
        self.assertIn("rating", first)
        self.assertIn("duration", first)

        # 2. Verify reading back from MySQL DB
        db_res = user_courses_handler("test-user-dynamic", skill=None, status=None, limit=50)
        self.assertTrue(db_res.get("success"))
        self.assertGreater(db_res.get("total", 0), 0)

        # 3. Verify status update
        saved_course = db_res["courses"][0]
        course_id = int(saved_course["id"])
        
        status_req_cls = status_handler.__annotations__["request"]
        status_req = status_req_cls(user_id="test-user-dynamic", status="in_progress")
        updated_res = status_handler(course_id, status_req)
        self.assertTrue(updated_res.get("success"))
        self.assertEqual(updated_res.get("course", {}).get("status"), "in_progress")

    def test_upsert_behavior(self):
        suggest_handler = next(
            r.endpoint for r in self.router.routes 
            if getattr(r, "path", "") == "/api/resources" and "POST" in getattr(r, "methods", set())
        )
        params = suggest_handler.__annotations__["request"]

        req = params(
            user_id="test-user-upsert",
            missing_skills=["Kubernetes"],
            use_ai=False,
            persist=True,
        )
        res1 = suggest_handler(req)
        count1 = res1.get("total")

        res2 = suggest_handler(req)
        count2 = res2.get("total")
        self.assertEqual(count1, count2)

    def test_empty_state_handling(self):
        suggest_handler = next(
            r.endpoint for r in self.router.routes 
            if getattr(r, "path", "") == "/api/resources" and "POST" in getattr(r, "methods", set())
        )
        params = suggest_handler.__annotations__["request"]

        req = params(
            user_id="test-user-empty",
            missing_skills=[],
            persist=True,
        )
        res = suggest_handler(req)
        self.assertTrue(res.get("success"))
        self.assertEqual(res.get("total", 0), 0)
        self.assertEqual(len(res.get("courses", [])), 0)


if __name__ == "__main__":
    unittest.main()

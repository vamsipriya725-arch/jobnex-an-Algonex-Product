import unittest
from datetime import date, datetime
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

import daily_jobs
import daily_scheduler
import main


class DailyJobsLogicTests(unittest.TestCase):
    def test_split_keywords(self):
        self.assertEqual(
            daily_jobs.split_keywords("python, sql, react"),
            ["python", "sql", "react"],
        )
        self.assertEqual(
            daily_jobs.split_keywords("python; fast-api\ndocker"),
            ["python", "fast-api", "docker"],
        )
        self.assertEqual(daily_jobs.split_keywords(""), [])
        self.assertEqual(daily_jobs.split_keywords("   "), [])
        self.assertEqual(daily_jobs.split_keywords(None), [])

    def test_today_returns_date(self):
        self.assertIsInstance(daily_jobs.today(), date)

    @patch("daily_jobs.daily_db")
    def test_run_daily_requires_resume(self, mock_db):
        mock_db.get_settings.return_value = {
            "resume_text": "",
            "keywords": "python",
        }
        with self.assertRaises(daily_jobs.DailyRunError):
            daily_jobs.run_daily()

    @patch("daily_jobs.daily_db")
    def test_run_daily_requires_keywords(self, mock_db):
        mock_db.get_settings.return_value = {
            "resume_text": "Experienced Python developer with SQL skills",
            "keywords": "",
        }
        with self.assertRaises(daily_jobs.DailyRunError):
            daily_jobs.run_daily()

    @patch("daily_jobs.daily_db")
    @patch("daily_jobs.fetch_jobs")
    @patch("daily_jobs.analyze_resume")
    def test_run_daily_successful_flow(self, mock_analyze, mock_fetch, mock_db):
        mock_db.get_settings.return_value = {
            "resume_text": "Experienced Python developer",
            "keywords": "python",
        }
        mock_db.existing_keys.return_value = set()
        mock_db.count_matches.return_value = 1
        mock_fetch.return_value = [
            {
                "title": "Backend Dev",
                "company": "Algonex",
                "location": "Remote",
                "job_type": "full_time",
                "url": "https://jobs.example.com/1",
                "description": "Python, SQL, Docker",
            }
        ]
        mock_analyze.return_value = {
            "matched_skills": ["python", "sql"],
            "missing_skills": ["docker"],
            "matched_score": 75.0,
        }

        result = daily_jobs.run_daily()

        self.assertEqual(result["fetched"], 1)
        self.assertEqual(result["new_scored"], 1)
        mock_db.add_match.assert_called_once()
        mock_db.set_last_run_date.assert_called_once()


class DailySchedulerTests(unittest.TestCase):
    def test_apply_schedule_and_next_run_time(self):
        daily_scheduler.apply_schedule(enabled=True, run_hour=14, run_minute=30)
        next_run = daily_scheduler.next_run_time()
        self.assertIsNotNone(next_run)
        self.assertIn("14:30:00", next_run)

    def test_next_run_time_none_when_disabled(self):
        daily_scheduler.apply_schedule(enabled=False, run_hour=14, run_minute=30)
        self.assertIsNone(daily_scheduler.next_run_time())


class DailyEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)

    @patch("main.daily_db")
    @patch("main.daily_scheduler")
    def test_get_daily_settings(self, mock_sched, mock_db):
        mock_db.get_settings.return_value = {
            "resume_text": "Senior Developer Resume",
            "keywords": "python, react",
            "min_score": 70.0,
            "run_hour": 10,
            "run_minute": 15,
            "enabled": True,
            "last_run_date": date(2026, 10, 19),
        }
        mock_sched.next_run_time.return_value = "2026-10-20T10:15:00"

        res = self.client.get("/api/daily/settings")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["keywords"], "python, react")
        self.assertEqual(data["last_run_date"], "2026-10-19")
        self.assertEqual(data["next_run"], "2026-10-20T10:15:00")

    @patch("main.daily_db")
    @patch("main.daily_scheduler")
    def test_save_daily_settings_success(self, mock_sched, mock_db):
        mock_db.get_settings.return_value = {
            "resume_text": "Updated Resume Text with more than 20 chars",
            "keywords": "fastapi, sql",
            "min_score": 65.0,
            "run_hour": 8,
            "run_minute": 0,
            "enabled": True,
            "last_run_date": None,
        }
        mock_sched.next_run_time.return_value = "2026-10-20T08:00:00"

        payload = {
            "resume_text": "Updated Resume Text with more than 20 chars",
            "keywords": "fastapi, sql",
            "min_score": 65.0,
            "run_hour": 8,
            "run_minute": 0,
            "enabled": True,
        }
        res = self.client.put("/api/daily/settings", json=payload)
        self.assertEqual(res.status_code, 200)
        mock_db.save_settings.assert_called_once()
        mock_sched.apply_schedule.assert_called_once_with(True, 8, 0)

    def test_save_daily_settings_validation_failure(self):
        # Short resume
        res = self.client.put(
            "/api/daily/settings",
            json={"resume_text": "short", "keywords": "python"},
        )
        self.assertEqual(res.status_code, 422)

    @patch("main.daily_jobs.run_daily")
    def test_run_daily_now_success(self, mock_run):
        mock_run.return_value = {"status": "completed", "matches_recorded": 5}
        res = self.client.post("/api/daily/run")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "completed")

    @patch("main.daily_jobs.run_daily")
    def test_run_daily_now_conflict_when_already_active(self, mock_run):
        mock_run.side_effect = daily_jobs.RunAlreadyActiveError("Already active")
        res = self.client.post("/api/daily/run")
        self.assertEqual(res.status_code, 409)

    @patch("main.daily_db")
    def test_get_daily_jobs(self, mock_db):
        mock_db.get_settings.return_value = {"min_score": 60.0}
        mock_db.list_matches.return_value = [
            {"job_title": "Python Dev", "match_score": 80.0}
        ]
        mock_db.count_matches.return_value = 3

        res = self.client.get("/api/daily/jobs?day=2026-10-19")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["hidden_below_min"], 2)


if __name__ == "__main__":
    unittest.main()

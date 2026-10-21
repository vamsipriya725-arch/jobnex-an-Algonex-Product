# test_auto_apply.py
# Tests for the auto-apply feature. No MySQL, internet or email account needed:
# the database, the jobs API and SMTP are all mocked.
#
# Run from the backend folder:
#     python -m unittest test_auto_apply -v
import unittest
from unittest.mock import MagicMock, patch

import auto_apply
import job_fetcher

RESUME = "Python developer with Python, SQL and React skills."
JD = "Looking for a Python developer with SQL and FastAPI."

SMTP_ENV = {
    "SMTP_HOST": "smtp.test.com",
    "SMTP_PORT": "587",
    "SMTP_USER": "me@test.com",
    "SMTP_PASSWORD": "secret",
    "APPLICANT_NAME": "Anil",
}


class CoverLetterAndEmailTests(unittest.TestCase):
    def test_valid_and_invalid_emails(self):
        self.assertTrue(auto_apply.is_valid_email("hr@company.com"))
        self.assertFalse(auto_apply.is_valid_email("not-an-email"))
        self.assertFalse(auto_apply.is_valid_email(""))
        self.assertFalse(auto_apply.is_valid_email(None))

    def test_score_job_uses_analyzer(self):
        result = auto_apply.score_job(RESUME, JD)
        self.assertEqual(result["matched_skills"], ["python", "sql"])
        self.assertEqual(result["matched_score"], 40.0)

    def test_cover_letter_contains_details(self):
        letter = auto_apply.build_cover_letter(
            "Anil", "Backend Developer", "Acme", ["python", "sql"]
        )
        self.assertIn("Acme", letter)
        self.assertIn("Backend Developer", letter)
        self.assertIn("python, sql", letter)
        self.assertTrue(letter.endswith("Anil"))

    def test_cover_letter_without_matched_skills(self):
        letter = auto_apply.build_cover_letter("Anil", "Dev", "Acme", [])
        self.assertIn("the skills listed in the role", letter)


class QueueApplicationTests(unittest.TestCase):
    def setUp(self):
        patcher = patch("auto_apply.apply_db")
        self.db = patcher.start()
        self.addCleanup(patcher.stop)
        self.db.find_duplicate.return_value = None
        self.db.add_application.return_value = 7
        self.db.get_application.return_value = {"application_id": 7, "status": "queued"}

    def test_queue_success(self):
        with patch.dict("os.environ", {"APPLICANT_NAME": "Anil"}):
            result = auto_apply.queue_application(
                RESUME, "Backend Dev", "Acme", JD,
                job_url="https://example.com/job", apply_email="hr@acme.com",
            )
        self.assertEqual(result["application_id"], 7)
        kwargs = self.db.add_application.call_args.kwargs
        self.assertEqual(kwargs["match_score"], 40.0)
        self.assertIn("Acme", kwargs["cover_letter"])

    def test_missing_fields_rejected(self):
        with self.assertRaises(auto_apply.InvalidApplicationError):
            auto_apply.queue_application(RESUME, "", "Acme", JD)

    def test_bad_email_rejected(self):
        with self.assertRaises(auto_apply.InvalidApplicationError):
            auto_apply.queue_application(
                RESUME, "Dev", "Acme", JD, apply_email="bad-email"
            )

    def test_duplicate_rejected(self):
        self.db.find_duplicate.return_value = {"application_id": 1, "status": "sent"}
        with self.assertRaises(auto_apply.DuplicateApplicationError):
            auto_apply.queue_application(RESUME, "Dev", "Acme", JD)
        self.db.add_application.assert_not_called()

    def test_low_match_rejected(self):
        with self.assertRaises(auto_apply.LowMatchError):
            auto_apply.queue_application("Cooking and gardening", "Dev", "Acme", JD)
        self.db.add_application.assert_not_called()

    def test_min_score_is_configurable(self):
        with patch.dict("os.environ", {"MIN_MATCH_SCORE": "80"}):
            with self.assertRaises(auto_apply.LowMatchError):
                auto_apply.queue_application(RESUME, "Dev", "Acme", JD)


class SendEmailTests(unittest.TestCase):
    def test_sends_email_through_smtp(self):
        with patch.dict("os.environ", SMTP_ENV, clear=True), \
                patch("auto_apply.smtplib.SMTP") as smtp_class:
            server = smtp_class.return_value.__enter__.return_value
            auto_apply.send_application_email("hr@acme.com", "Subject", "Body")

        smtp_class.assert_called_once_with("smtp.test.com", 587, timeout=30)
        server.starttls.assert_called_once()
        server.login.assert_called_once_with("me@test.com", "secret")
        server.send_message.assert_called_once()
        message = server.send_message.call_args.args[0]
        self.assertEqual(message["To"], "hr@acme.com")
        self.assertEqual(message["Subject"], "Subject")

    def test_attaches_resume_when_file_exists(self):
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as handle:
            handle.write(b"%PDF-1.4 fake")
            pdf_path = handle.name

        with patch.dict("os.environ", SMTP_ENV, clear=True), \
                patch("auto_apply.smtplib.SMTP") as smtp_class:
            server = smtp_class.return_value.__enter__.return_value
            auto_apply.send_application_email("hr@acme.com", "S", "B", pdf_path)

        message = server.send_message.call_args.args[0]
        names = [part.get_filename() for part in message.iter_attachments()]
        self.assertEqual(len(names), 1)
        self.assertTrue(names[0].endswith(".pdf"))

    def test_missing_smtp_credentials(self):
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(auto_apply.ApplyError):
                auto_apply.send_application_email("hr@acme.com", "S", "B")


class ApplyToApplicationTests(unittest.TestCase):
    def setUp(self):
        patcher = patch("auto_apply.apply_db")
        self.db = patcher.start()
        self.addCleanup(patcher.stop)
        self.db.count_sent_today.return_value = 0
        self.queued = {
            "application_id": 3,
            "job_title": "Backend Dev",
            "company": "Acme",
            "apply_email": "hr@acme.com",
            "cover_letter": "Dear Acme",
            "status": "queued",
        }

    def test_not_found(self):
        self.db.get_application.return_value = None
        with self.assertRaises(auto_apply.ApplicationNotFoundError):
            auto_apply.apply_to_application(99)

    def test_already_sent_is_not_sent_again(self):
        self.db.get_application.return_value = {**self.queued, "status": "sent"}
        with patch("auto_apply.send_application_email") as sender:
            auto_apply.apply_to_application(3)
        sender.assert_not_called()

    def test_no_email_marks_manual_required(self):
        self.db.get_application.return_value = {**self.queued, "apply_email": None}
        with patch("auto_apply.send_application_email") as sender:
            auto_apply.apply_to_application(3)
        sender.assert_not_called()
        self.assertEqual(self.db.update_status.call_args.args[:2], (3, "manual_required"))

    def test_daily_limit(self):
        self.db.get_application.return_value = self.queued
        self.db.count_sent_today.return_value = 10
        with patch.dict("os.environ", {"MAX_APPLICATIONS_PER_DAY": "10"}):
            with patch("auto_apply.send_application_email") as sender:
                with self.assertRaises(auto_apply.DailyLimitError):
                    auto_apply.apply_to_application(3)
        sender.assert_not_called()

    def test_successful_send(self):
        self.db.get_application.return_value = self.queued
        with patch.dict("os.environ", {"APPLICANT_NAME": "Anil"}), \
                patch("auto_apply.send_application_email") as sender:
            auto_apply.apply_to_application(3)
        sender.assert_called_once()
        self.assertEqual(sender.call_args.args[0], "hr@acme.com")
        self.assertEqual(self.db.update_status.call_args.args[:2], (3, "sent"))

    def test_smtp_failure_marks_failed(self):
        self.db.get_application.return_value = self.queued
        with patch("auto_apply.send_application_email",
                   side_effect=RuntimeError("SMTP down")):
            auto_apply.apply_to_application(3)
        args = self.db.update_status.call_args.args
        self.assertEqual(args[:2], (3, "failed"))
        self.assertIn("SMTP down", args[2])


class JobFetcherTests(unittest.TestCase):
    def setUp(self):
        job_fetcher._CACHE.clear()

    def test_fetch_jobs_parses_and_cleans_html(self):
        fake = MagicMock()
        fake.json.return_value = {"jobs": [{
            "title": "Python Dev",
            "company_name": "Acme",
            "candidate_required_location": "Worldwide",
            "job_type": "full_time",
            "url": "https://remotive.com/job/1",
            "description": "<p>We use <b>Python</b> &amp; SQL</p>",
        }]}
        with patch("job_fetcher.requests.get", return_value=fake) as getter:
            jobs = job_fetcher.fetch_jobs("python", 5)

        self.assertEqual(jobs[0]["title"], "Python Dev")
        self.assertEqual(jobs[0]["company"], "Acme")
        self.assertEqual(jobs[0]["description"], "We use Python & SQL")
        self.assertEqual(getter.call_args.kwargs["params"], {"search": "python", "limit": 5})

    def test_results_are_cached(self):
        fake = MagicMock()
        fake.json.return_value = {"jobs": []}
        with patch("job_fetcher.requests.get", return_value=fake) as getter:
            job_fetcher.fetch_jobs("python", 5)
            job_fetcher.fetch_jobs("Python", 5)
        self.assertEqual(getter.call_count, 1)

    def test_empty_keyword(self):
        with self.assertRaises(ValueError):
            job_fetcher.fetch_jobs("  ")

    def test_network_error(self):
        import requests
        with patch("job_fetcher.requests.get",
                   side_effect=requests.ConnectionError("boom")):
            with self.assertRaises(job_fetcher.JobFetchError):
                job_fetcher.fetch_jobs("python")


class EndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient
        import main
        cls.client = TestClient(main.app)

    def test_search_jobs(self):
        with patch("main.fetch_jobs", return_value=[{"title": "Dev"}]):
            response = self.client.get("/api/jobs/search?keyword=python")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["jobs"][0]["title"], "Dev")

    def test_search_jobs_requires_keyword(self):
        response = self.client.get("/api/jobs/search")
        self.assertEqual(response.status_code, 422)

    def test_search_jobs_upstream_failure(self):
        with patch("main.fetch_jobs", side_effect=job_fetcher.JobFetchError("down")):
            response = self.client.get("/api/jobs/search?keyword=python")
        self.assertEqual(response.status_code, 502)

    def _payload(self):
        return {
            "resume_text": RESUME, "job_title": "Dev", "company": "Acme",
            "job_description": JD, "apply_email": "hr@acme.com",
        }

    def test_queue_success(self):
        with patch("main.auto_apply.queue_application",
                   return_value={"application_id": 1, "status": "queued"}):
            response = self.client.post("/api/applications", json=self._payload())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "queued")

    def test_queue_duplicate_returns_409(self):
        with patch("main.auto_apply.queue_application",
                   side_effect=auto_apply.DuplicateApplicationError("dup")):
            response = self.client.post("/api/applications", json=self._payload())
        self.assertEqual(response.status_code, 409)

    def test_queue_low_match_returns_422(self):
        with patch("main.auto_apply.queue_application",
                   side_effect=auto_apply.LowMatchError("low")):
            response = self.client.post("/api/applications", json=self._payload())
        self.assertEqual(response.status_code, 422)

    def test_list_applications(self):
        with patch("main.apply_db.list_applications", return_value=[{"application_id": 1}]):
            response = self.client.get("/api/applications")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["applications"]), 1)

    def test_approve_success(self):
        with patch("main.auto_apply.apply_to_application",
                   return_value={"application_id": 1, "status": "sent"}):
            response = self.client.post("/api/applications/1/approve")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "sent")

    def test_approve_not_found(self):
        with patch("main.auto_apply.apply_to_application",
                   side_effect=auto_apply.ApplicationNotFoundError("nope")):
            response = self.client.post("/api/applications/99/approve")
        self.assertEqual(response.status_code, 404)

    def test_approve_daily_limit(self):
        with patch("main.auto_apply.apply_to_application",
                   side_effect=auto_apply.DailyLimitError("limit")):
            response = self.client.post("/api/applications/1/approve")
        self.assertEqual(response.status_code, 429)


if __name__ == "__main__":
    unittest.main()
import unittest
from resume_privacy import redact_text, count_pii_entities


class TestResumePrivacy(unittest.TestCase):
    def test_redact_email(self):
        text = "Contact me at bhavani@example.com for more info."
        redacted = redact_text(text)
        self.assertNotIn("bhavani@example.com", redacted)
        self.assertIn("[EMAIL REMOVED]", redacted)

    def test_redact_phone(self):
        text = "Phone number is 9876543210 or +91 98765 43210."
        redacted = redact_text(text)
        self.assertNotIn("9876543210", redacted)
        self.assertIn("[PHONE REMOVED]", redacted)

    def test_redact_url(self):
        text = "Portfolio at https://github.com/bhavanikandula or www.linkedin.com/in/bhavani."
        redacted = redact_text(text)
        self.assertNotIn("https://github.com/bhavanikandula", redacted)
        self.assertNotIn("www.linkedin.com/in/bhavani", redacted)
        self.assertIn("[LINK REMOVED]", redacted)

    def test_bare_url(self):
        text = "Visit linkedin.com/in/bhavani or github.com/bhavanikandula for code."
        redacted = redact_text(text)
        self.assertNotIn("linkedin.com/in/bhavani", redacted)
        self.assertNotIn("github.com/bhavanikandula", redacted)
        self.assertIn("[LINK REMOVED]", redacted)

    def test_strict_pin_redaction(self):
        text = "Address: Hyderabad, PIN: 500081, India."
        self.assertIn("500081", redact_text(text, level="standard"))
        self.assertIn("[LOCATION REMOVED]", redact_text(text, level="strict"))

    def test_strict_id_redaction(self):
        text = "PAN Card: ABCDE1234F and Aadhaar: 1234 5678 9012."
        redacted = redact_text(text, level="strict")
        self.assertNotIn("ABCDE1234F", redacted)
        self.assertNotIn("1234 5678 9012", redacted)
        self.assertIn("[ID REMOVED]", redacted)

    def test_count_pii_entities(self):
        text = "Email: test@example.com, Phone: 9876543210, PIN: 500081."
        stats = count_pii_entities(text)
        self.assertEqual(stats["emails"], 1)
        self.assertEqual(stats["phones"], 1)
        self.assertEqual(stats["pins"], 1)
        self.assertGreaterEqual(stats["total"], 3)

    def test_no_sensitive_info(self):
        text = "Skilled in Python, SQL, and FastAPI."
        self.assertEqual(redact_text(text), text)

    def test_reveal_endpoint_404_for_unknown_id(self):
        try:
            from database import get_connection
            conn = get_connection()
            conn.close()
        except Exception as e:
            self.skipTest(f"MySQL not available: {e}")

        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from resume_privacy import router

        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)

        res = client.get("/api/privacy/reveal/99999999")
        self.assertEqual(res.status_code, 404)


if __name__ == "__main__":
    unittest.main()
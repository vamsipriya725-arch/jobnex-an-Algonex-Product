import unittest

from resume_privacy import redact_text


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

    def test_no_sensitive_info(self):
        text = "Skilled in Python, SQL, and FastAPI."
        self.assertEqual(redact_text(text), text)


if __name__ == "__main__":
    unittest.main()
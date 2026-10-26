"""
Test Suite for JobNex Skills Extractor (Backend/skills_extractor.py)
Tests offline behavior with Gemini mocked to ensure:
  (a) The Dover junk text must not produce skills like 'drag', 'drop', 'terms';
  (b) Generic words are excluded (about, before, within, experience, name, phone, email, location, url, linkedin, github);
  (c) A sample resume does not return 'Associate' or 'Apr' or action verbs;
  (d) Normalization and dedupe (API/APIs -> api, CI/CD, ci-cd -> ci/cd, JS -> javascript).

Can be run via:
    python test_skills_extractor.py
or
    pytest test_skills_extractor.py
"""

import sys
import unittest
from unittest.mock import patch

from skills_extractor import (
    extract_skills,
    normalize_skill,
    clean_and_dedupe_skills,
    format_skill_for_display,
    EXCLUDED_WORDS,
    NORMALIZATION_MAP,
)


class TestSkillsExtractor(unittest.TestCase):

    def setUp(self):
        # Patch out Gemini calls so all tests run deterministically and offline
        self.gemini_patch = patch("skills_extractor._call_gemini_skill_extraction", return_value=None)
        self.gemini_patch.start()

    def tearDown(self):
        self.gemini_patch.stop()

    def test_case_a_dover_junk_text_filtered(self):
        """(a) Dover junk text must not produce skills like 'drag', 'drop', 'terms', 'powered'."""
        dover_junk = (
            "Resume *\n"
            "Drag and drop file or browse computer\n"
            "(PDF or DOCX, 5 MB maximum)\n\n"
            "Jobs powered by Dover Logo\n"
            "By applying you agree to Dover's terms and privacy policy.\n"
        )
        res = extract_skills(dover_junk, source="jd")
        extracted = res.get("all_skills", [])

        # Ensure no boilerplate tokens made it through
        unwanted = ["drag", "drop", "terms", "powered", "dover", "file", "browse", "computer", "resume", "maximum", "agree"]
        for word in unwanted:
            self.assertNotIn(word, extracted, f"Junk token '{word}' should not be in extracted skills")

    def test_case_b_generic_words_excluded(self):
        """(b) Generic filler words are strictly excluded."""
        generic_text = (
            "About us: Before applying, within 2 weeks provide your name, phone, email, "
            "location, url, linkedin, and github portfolio. Experience is preferred."
        )
        res = extract_skills(generic_text, source="jd")
        extracted = res.get("all_skills", [])

        forbidden_generics = [
            "about", "before", "within", "experience", "name",
            "phone", "email", "location", "url", "linkedin", "github"
        ]
        for word in forbidden_generics:
            self.assertNotIn(word, extracted, f"Generic word '{word}' must be excluded")

    def test_case_c_sample_resume_no_non_skills(self):
        """(c) A sample resume does not return 'Associate', 'Apr', or verbs like 'Architected'."""
        resume_text = (
            "Vamsi Priya Tavva | Associate Software Engineer\n"
            "Email: vamsi@example.com | Phone: 9199000000 | Location: Bengaluru | url: http://linkedin.com/in/vamsi\n"
            "Experience:\n"
            "Associate Engineer at Algonex (Apr 2023 - Present)\n"
            "- Architected microservices and REST APIs using Python, FastAPI, and PostgreSQL.\n"
            "- Developed responsive web applications using React, JavaScript, and Tailwind CSS.\n"
            "- Automated CI/CD pipelines with Docker and AWS.\n"
        )
        res = extract_skills(resume_text, source="resume")
        extracted = res.get("all_skills", [])

        # Non-skills that must NOT appear
        non_skills = ["associate", "apr", "architected", "developed", "url", "analyzer", "aidlc", "engineer"]
        for word in non_skills:
            self.assertNotIn(word, extracted, f"Non-skill '{word}' should never be extracted")

        # Real technical skills that MUST be found
        self.assertTrue(any(s in extracted for s in ["python", "react", "docker", "aws", "postgresql", "fastapi"]))

    def test_case_d_normalization_and_dedupe(self):
        """(d) Normalization and deduplication: APIs -> api, CI/CD, ci-cd -> ci/cd, JS -> javascript."""
        # Test individual normalization
        self.assertEqual(normalize_skill("APIs"), "api")
        self.assertEqual(normalize_skill("API"), "api")
        self.assertEqual(normalize_skill("ci-cd"), "ci/cd")
        self.assertEqual(normalize_skill("CI/CD"), "ci/cd")
        self.assertEqual(normalize_skill("cicd"), "ci/cd")
        self.assertEqual(normalize_skill("JS"), "javascript")
        self.assertEqual(normalize_skill("TS"), "typescript")
        self.assertEqual(normalize_skill("py"), "python")
        self.assertEqual(normalize_skill("postgres"), "postgresql")

        # Test cleaning and deduplicating list
        raw_list = ["API", "apis", "APIs", "ci-cd", "CI/CD", "CI / CD", "JS", "javascript", "Python", "python"]
        cleaned = clean_and_dedupe_skills(raw_list)

        self.assertIn("api", cleaned)
        self.assertIn("ci/cd", cleaned)
        self.assertIn("javascript", cleaned)
        self.assertIn("python", cleaned)

        # Count occurrences (must be exactly 1 each)
        self.assertEqual(cleaned.count("api"), 1)
        self.assertEqual(cleaned.count("ci/cd"), 1)
        self.assertEqual(cleaned.count("javascript"), 1)
        self.assertEqual(cleaned.count("python"), 1)

    def test_display_name_formatting(self):
        """Tests that skills format professionally for UI presentation."""
        self.assertEqual(format_skill_for_display("ci/cd"), "CI/CD")
        self.assertEqual(format_skill_for_display("api"), "API")
        self.assertEqual(format_skill_for_display("aws"), "AWS")
        self.assertEqual(format_skill_for_display("react"), "React")
        self.assertEqual(format_skill_for_display("postgresql"), "PostgreSQL")
        self.assertEqual(format_skill_for_display("node.js"), "Node.js")


if __name__ == "__main__":
    print("Running JobNex Skills Extractor Offline Unit Tests...")
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(TestSkillsExtractor)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)

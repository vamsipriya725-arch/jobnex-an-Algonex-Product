"""
Run from the Backend folder:
    python test_suggestion_resource.py
No MySQL, API key or internet needed (Gemini and link checks are faked).
Router tests need: pip install fastapi httpx
"""
import json
import unittest
from unittest import mock

# pyrefly: ignore[missing-import]
import suggestions_resources as sr
# pyrefly: ignore[missing-import]
from analyzer import analyse_resume
# pyrefly: ignore[missing-import]
from suggestions_resources import (
    Resource,
    normalize_skill,
    parse_missing_skills,
    parse_ai_response,
    get_resources_for_skill,
    suggest_resources,
    build_learning_path,
    build_overview,
    pretty_skill,
    create_router,
)

try:
    # pyrefly: ignore[missing-import]
    from fastapi import FastAPI
    # pyrefly: ignore[missing-import]
    from fastapi.testclient import TestClient
    HAS_FASTAPI = True
except Exception:
    HAS_FASTAPI = False

NOT_DEAD = lambda url: False


def fake_ai(skills):
    """What a good Gemini answer looks like (includes one hallucinated site)."""
    return {
        "python": [
            {"platform": "W3Schools", "title": "Python Tutorial", "url": "https://www.w3schools.com/python/", "type": "tutorial", "tip": "Start here"},
            {"platform": "Fake", "title": "Fake", "url": "https://totally-fake-site.com/python", "type": "course", "tip": ""},
            {"platform": "HackerRank", "title": "Python Practice", "url": "https://www.hackerrank.com/domains/python", "type": "practice", "tip": "Solve daily"},
            {"platform": "freeCodeCamp", "title": "Python course", "url": "https://www.freecodecamp.org/learn/scientific-computing-with-python/", "type": "course", "tip": ""},
        ]
    }


def failing_ai(skills):
    raise RuntimeError("Gemini unavailable")


def must_not_call(skills):
    raise AssertionError("Gemini should not be called")


class TestHelpers(unittest.TestCase):
    def test_aliases(self):
        self.assertEqual(normalize_skill("JS"), "javascript")
        self.assertEqual(normalize_skill("  React.js "), "react")
        self.assertEqual(normalize_skill("C++"), "cpp")

    def test_valid_url(self):
        self.assertTrue(sr._valid_url("https://www.w3schools.com/python/"))
        self.assertFalse(sr._valid_url("http://www.w3schools.com/python/"))
        self.assertFalse(sr._valid_url("javascript:alert(1)"))
        self.assertFalse(sr._valid_url("https://a.com/with space"))
        self.assertFalse(sr._valid_url(None))

    def test_domain_allow_list(self):
        self.assertEqual(sr._domain_platform("https://www.w3schools.com/sql/"), "W3Schools")
        self.assertEqual(sr._domain_platform("https://docs.python.org/3/tutorial/"), "Official Docs")
        self.assertIsNone(sr._domain_platform("https://w3schools.com.evil.com/x"))
        self.assertIsNone(sr._domain_platform("https://totally-fake-site.com/x"))

    def test_text_sanitizer(self):
        self.assertEqual(sr._text("<script>hi</script>  there", 50), "scripthi/script there")
        self.assertEqual(sr._text(123, 50), "")
        self.assertEqual(len(sr._text("a" * 500, 120)), 120)


class TestParseMissingSkills(unittest.TestCase):
    def test_none_and_empty(self):
        self.assertEqual(parse_missing_skills(None), [])
        self.assertEqual(parse_missing_skills("   "), [])

    def test_json_array_like_main_py_stores(self):
        self.assertEqual(parse_missing_skills(json.dumps(["python", "sql"])), ["python", "sql"])

    def test_comma_and_mixed_separators(self):
        self.assertEqual(parse_missing_skills("Python, SQL ,Docker"), ["Python", "SQL", "Docker"])
        self.assertEqual(parse_missing_skills("Python;SQL|Git\nDocker"), ["Python", "SQL", "Git", "Docker"])

    def test_broken_json_bytes_and_junk(self):
        self.assertEqual(parse_missing_skills("['Python', 'SQL']"), ["Python", "SQL"])
        self.assertEqual(parse_missing_skills(b'["sql"]'), ["sql"])
        self.assertEqual(parse_missing_skills(["Python", " ", None, 5]), ["Python"])


class TestParseAiResponse(unittest.TestCase):
    def test_valid_json(self):
        text = json.dumps({"skills": [{"skill": "python", "resources": [{"url": "https://x.com"}]}]})
        self.assertEqual(list(parse_ai_response(text)), ["python"])

    def test_fenced_json(self):
        text = '```json\n{"skills": [{"skill": "sql", "resources": []}]}\n```'
        self.assertIn("sql", parse_ai_response(text))

    def test_bad_inputs_return_empty(self):
        for bad in [None, "", "not json", '{"skills": "nope"}', "[1, 2]", 42]:
            self.assertEqual(parse_ai_response(bad), {})


class TestCatalog(unittest.TestCase):
    def test_known_skill_direct_links(self):
        by_platform = {r.platform: r for r in get_resources_for_skill("python", 10)}
        self.assertEqual(by_platform["W3Schools"].url, "https://www.w3schools.com/python/")
        self.assertEqual(by_platform["HackerRank"].url, "https://www.hackerrank.com/domains/python")

    def test_analyzer_skills_have_direct_link(self):
        for skill in ["python", "sql", "react", "fastapi", "docker"]:
            self.assertTrue(any(r.is_direct for r in get_resources_for_skill(skill, 10)), skill)

    def test_unknown_skill_fallback_and_encoding(self):
        res = get_resources_for_skill("C++ & Prompt Engineering", 10)
        self.assertTrue(len(res) >= 5)
        for r in res:
            self.assertTrue(r.url.startswith("https://"))
            self.assertNotIn(" ", r.url)

    def test_invalid_inputs_raise(self):
        with self.assertRaises(ValueError):
            get_resources_for_skill("   ")
        with self.assertRaises(ValueError):
            get_resources_for_skill("python", max_per_skill=0)


class TestSuggestWithAI(unittest.TestCase):
    def run_python(self, **kw):
        kw.setdefault("ai_generator", fake_ai)
        kw.setdefault("link_checker", NOT_DEAD)
        return suggest_resources(["python"], **kw)["suggestions"][0]["resources"]

    def test_gemini_links_first_and_hallucinated_dropped(self):
        res = self.run_python()
        self.assertEqual([r["source"] for r in res[:3]], ["gemini"] * 3)
        self.assertNotIn("totally-fake-site.com", " ".join(r["url"] for r in res))
        self.assertEqual(res[0]["tip"], "Start here")

    def test_exactly_four_by_default_and_topped_up(self):
        res = self.run_python()
        self.assertEqual(len(res), 4)
        self.assertEqual(res[3]["source"], "catalog")

    def test_no_duplicate_platforms(self):
        platforms = [r["platform"] for r in self.run_python()]
        self.assertEqual(len(platforms), len(set(platforms)))

    def test_max_per_skill_three(self):
        self.assertEqual(len(self.run_python(max_per_skill=3)), 3)

    def test_max_per_skill_out_of_range(self):
        for bad in (2, 5, 0, True):
            with self.assertRaises(ValueError):
                suggest_resources(["python"], max_per_skill=bad, use_ai=False)

    def test_dead_link_is_dropped_and_replaced(self):
        res = self.run_python(link_checker=lambda u: "hackerrank" in u)
        gemini_urls = [r["url"] for r in res if r["source"] == "gemini"]
        self.assertFalse(any("hackerrank" in u for u in gemini_urls))
        self.assertEqual(len(res), 4)

    def test_checker_exception_counts_as_alive(self):
        def boom(url):
            raise RuntimeError("network")
        res = self.run_python(link_checker=boom)
        self.assertEqual(sum(r["source"] == "gemini" for r in res), 3)

    def test_ai_used_flag(self):
        out = suggest_resources(["python"], ai_generator=fake_ai, link_checker=NOT_DEAD)
        self.assertTrue(out["ai_used"])


class TestFallbacks(unittest.TestCase):
    def test_gemini_failure_uses_catalog_with_3_to_4(self):
        skills = ["python", "sql", "react", "fastapi", "docker", "Prompt Engineering"]
        out = suggest_resources(skills, ai_generator=failing_ai)
        self.assertFalse(out["ai_used"])
        for s in out["suggestions"]:
            self.assertIn(len(s["resources"]), (3, 4))
            self.assertTrue(all(r["source"] == "catalog" for r in s["resources"]))

    def test_skill_missing_from_ai_answer_uses_catalog(self):
        out = suggest_resources(["python", "docker"], ai_generator=fake_ai, link_checker=NOT_DEAD)
        docker = out["suggestions"][1]
        self.assertEqual(len(docker["resources"]), 4)
        self.assertTrue(all(r["source"] == "catalog" for r in docker["resources"]))

    def test_use_ai_false_never_calls_gemini(self):
        out = suggest_resources(["python"], use_ai=False, ai_generator=must_not_call)
        self.assertFalse(out["ai_used"])
        self.assertEqual(len(out["suggestions"][0]["resources"]), 4)

    def test_default_generator_failure_is_handled(self):
        with mock.patch.object(sr, "_default_ai_generator", side_effect=RuntimeError("no key")):
            out = suggest_resources(["python"])
        self.assertFalse(out["ai_used"])
        self.assertEqual(len(out["suggestions"][0]["resources"]), 4)

    def test_ai_returns_garbage(self):
        garbage = {"python": [{"url": "javascript:alert(1)"}, "x", {}, 5, None]}
        out = suggest_resources(["python"], ai_generator=lambda s: garbage)
        self.assertFalse(out["ai_used"])
        self.assertEqual(len(out["suggestions"][0]["resources"]), 4)

    def test_edge_inputs(self):
        self.assertEqual(suggest_resources([], use_ai=False)["total_skills"], 0)
        self.assertEqual(suggest_resources(None, use_ai=False)["total_skills"], 0)
        self.assertEqual(suggest_resources("python", use_ai=False)["total_skills"], 1)
        out = suggest_resources(["python", "", None, 42, "PYTHON"], use_ai=False)
        self.assertEqual(out["total_skills"], 1)
        self.assertEqual(len(out["skipped"]), 3)
        with self.assertRaises(TypeError):
            suggest_resources(123, use_ai=False)

    def test_dedupes_aliases_and_keeps_order(self):
        out = suggest_resources(["docker", "JS", "javascript", "git"], use_ai=False)
        self.assertEqual([s["skill"] for s in out["suggestions"]], ["docker", "JS", "git"])

    def test_long_ai_phrase_is_shortened(self):
        phrase = ("Basic Administrative Skills: Experience with administrative tasks, "
                  "such as data entry, record-keeping, or document management.")
        out = suggest_resources([phrase], use_ai=False)
        self.assertEqual(out["suggestions"][0]["skill"], "Basic Administrative Skills")


class TestLearningPath(unittest.TestCase):
    def test_pretty_skill(self):
        self.assertEqual(pretty_skill("sql"), "SQL")
        self.assertEqual(pretty_skill("fastapi"), "FastAPI")
        self.assertEqual(pretty_skill("prompt engineering"), "Prompt Engineering")
        self.assertEqual(pretty_skill("LangChain"), "LangChain")

    def test_message_exists_without_ai(self):
        msg = suggest_resources(["python"], use_ai=False)["suggestions"][0]["message"]
        self.assertIn("Python", msg)
        self.assertIn("First,", msg)
        self.assertIn("Finally,", msg)
        self.assertNotIn("None", msg)

    def test_practice_comes_last_and_mentions_platforms(self):
        msg = suggest_resources(["python"], use_ai=False)["suggestions"][0]["message"]
        self.assertTrue(msg.rstrip(".").endswith("HackerRank"))
        self.assertIn("W3Schools", msg)

    def test_gemini_tip_is_included(self):
        out = suggest_resources(["python"], ai_generator=fake_ai, link_checker=NOT_DEAD)
        self.assertIn("Tip: Start here.", out["suggestions"][0]["message"])

    def test_messages_for_3_and_4_resources(self):
        for n in (3, 4):
            out = suggest_resources(["sql", "docker", "Prompt Engineering"], max_per_skill=n, use_ai=False)
            for s in out["suggestions"]:
                self.assertTrue(s["message"].endswith("."))
                self.assertGreaterEqual(s["message"].count(". "), n)

    def test_single_resource_message(self):
        res = Resource("W3Schools", "Python", "https://www.w3schools.com/python/", "tutorial", True)
        msg = build_learning_path("python", [res])
        self.assertIn("To start, learn the basics on W3Schools.", msg)

    def test_no_resources_message(self):
        self.assertIn("couldn't find", build_learning_path("python", []))

    def test_overview_text(self):
        self.assertIn("1 skill to work on: Python.", build_overview(["python"]))
        self.assertIn("3 skills to work on: Python, SQL and Docker.", build_overview(["python", "sql", "docker"]))
        self.assertIn("no skill gaps", build_overview([]))

    def test_overview_in_response(self):
        out = suggest_resources(["python", "sql"], use_ai=False)
        self.assertIn("Python and SQL", out["summary"])


class TestWithRealAnalyzer(unittest.TestCase):
    def test_pipeline(self):
        result = analyse_resume("I know python only " * 5, "python sql react fastapi docker " * 3)
        self.assertEqual(result["missing_skills"], ["sql", "react", "fastapi", "docker"])
        out = suggest_resources(result["missing_skills"], use_ai=False)
        self.assertEqual(out["total_skills"], 4)

    def test_pipeline_with_db_format(self):
        result = analyse_resume("python " * 10, "python sql " * 10)
        stored = json.dumps(result["missing_skills"])
        out = suggest_resources(parse_missing_skills(stored), use_ai=False)
        self.assertEqual(out["total_skills"], len(result["missing_skills"]))


@unittest.skipUnless(HAS_FASTAPI, "fastapi/httpx not installed")
class TestEndpoints(unittest.TestCase):
    def setUp(self):
        fake_db = {1: json.dumps(["python", "docker"]), 2: "", 3: '["sql"]'}

        def fake_fetch(analysis_id):
            if analysis_id == 500:
                raise RuntimeError("db down")
            return fake_db.get(analysis_id)

        app = FastAPI()
        app.include_router(create_router(fake_fetch, ai_generator=fake_ai, link_checker=NOT_DEAD))
        self.client = TestClient(app)

    def test_post_returns_four_per_skill_with_ai(self):
        r = self.client.post("/api/resources", json={"missing_skills": ["python", "docker"]})
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertTrue(body["ai_used"])
        self.assertIn("summary", body)
        for s in body["suggestions"]:
            self.assertEqual(len(s["resources"]), 4)
            self.assertTrue(s["message"])

    def test_post_three_resources(self):
        r = self.client.post("/api/resources", json={"missing_skills": ["python"], "max_per_skill": 3})
        self.assertEqual(len(r.json()["suggestions"][0]["resources"]), 3)

    def test_post_use_ai_false(self):
        r = self.client.post("/api/resources", json={"missing_skills": ["python"], "use_ai": False})
        self.assertFalse(r.json()["ai_used"])

    def test_post_validation_errors(self):
        for bad in (2, 5):
            r = self.client.post("/api/resources", json={"missing_skills": ["python"], "max_per_skill": bad})
            self.assertEqual(r.status_code, 422)

    def test_get_reads_db_value(self):
        r = self.client.get("/api/resources/1")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["Analysis_Id"], 1)
        self.assertEqual(body["total_skills"], 2)

    def test_empty_column_missing_row_and_db_failure(self):
        self.assertEqual(self.client.get("/api/resources/2").json()["total_skills"], 0)
        self.assertEqual(self.client.get("/api/resources/99").status_code, 404)
        self.assertEqual(self.client.get("/api/resources/500").status_code, 503)

    def test_get_invalid_max_per_skill(self):
        self.assertEqual(self.client.get("/api/resources/1?max_per_skill=5").status_code, 422)


if __name__ == "__main__":
    unittest.main(verbosity=2)
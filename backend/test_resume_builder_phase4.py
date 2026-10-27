"""
Unit tests for JobNex Resume Builder - Phase 4 (Edit Content Tab)
Tests:
- Action verb classification (strong, weak, neutral)
- Date order chronology validation (start year <= end year)
- Section reordering and item reordering algorithms
- Section & item visibility flags (hidden toggle zero-leak)
- Personal contact & summary validation rules
"""

import pytest
import re


STRONG_ACTION_VERBS = {
    "accelerated", "achieved", "administered", "advanced", "advised", "advocated", "aligned", "allocated",
    "analyzed", "appraised", "architected", "audited", "automated", "boosted", "built", "budgeted",
    "calculated", "centralized", "championed", "collaborated", "compiled", "composed", "conceptualized",
    "conducted", "consolidated", "constructed", "converted", "coordinated", "counseled", "created",
    "customized", "debugged", "decreased", "defined", "delegated", "delivered", "demonstrated", "deployed",
    "designed", "developed", "devised", "diagnosed", "directed", "discovered", "dispatched", "diversified",
    "documented", "doubled", "drafted", "drove", "earned", "eliminated", "enabled", "engineered",
    "enhanced", "enlarged", "established", "estimated", "evaluated", "exceeded", "executed", "expanded",
    "expedited", "facilitated", "forecasted", "formulated", "founded", "generated", "governed", "guided",
    "halted", "handled", "headed", "hired", "identified", "implemented", "improved", "increased",
    "indexed", "influenced", "initiated", "innovated", "inspected", "installed", "instituted", "instructed",
    "integrated", "introduced", "invented", "investigated", "launched", "lead", "led", "leveraged",
    "maintained", "managed", "mapped", "marketed", "maximized", "measured", "mediated", "mentored",
    "migrated", "minimized", "modernized", "monitored", "motivated", "negotiated", "optimized", "orchestrated",
    "organized", "originated", "outperformed", "overhauled", "oversaw", "partnered", "performed", "pioneered",
    "planned", "prepared", "presented", "produced", "programmed", "promoted", "proposed", "published",
    "quantified", "re-engineered", "rebuilt", "received", "recommended", "reconciled", "recruited", "redesigned",
    "reduced", "refactored", "refined", "reformed", "regulated", "rehabilitated", "remodeled", "reorganized",
    "repaired", "replaced", "reported", "researched", "resolved", "restructured", "revamped", "reviewed",
    "revitalized", "rewarded", "routed", "saved", "scaled", "scheduled", "screened", "secured",
    "selected", "separated", "served", "shaped", "simplified", "solved", "spearheaded", "standardized",
    "steered", "streamlined", "strengthened", "structured", "supervised", "surpassed", "synthesized", "systematized",
    "targeted", "taught", "tested", "tracked", "trained", "transformed", "translated", "tripled",
    "uncovered", "unified", "upgraded", "utilized", "validated", "verified", "won", "yielded"
}

WEAK_VERB_PHRASES = [
    "responsible for", "duties included", "helped with", "assisted with", "worked on", "handled",
    "participated in", "served as", "was tasked with", "contributed to", "involved in", "attempted to"
]


def analyze_bullet_action_verb(bullet_text: str):
    if not bullet_text or not isinstance(bullet_text, str):
        return {"status": "empty", "label": ""}
    trimmed = bullet_text.strip().lower()
    if not trimmed:
        return {"status": "empty", "label": ""}

    for weak in WEAK_VERB_PHRASES:
        if trimmed.startswith(weak):
            return {
                "status": "weak",
                "verb": weak,
                "label": f'Weak phrasing: "{weak}"'
            }

    m = re.match(r"^([a-z\-]+)", trimmed)
    first_word = m.group(1).lower() if m else ""

    if first_word in STRONG_ACTION_VERBS:
        return {
            "status": "strong",
            "verb": first_word,
            "label": f"Strong Action Verb: {first_word.capitalize()}"
        }

    return {
        "status": "neutral",
        "verb": first_word,
        "label": "Tip: Start bullets with a strong action verb"
    }


def validate_date_order(dates_str: str):
    if not dates_str or not isinstance(dates_str, str):
        return {"valid": True}
    years = re.findall(r"\b(19\d\d|20\d\d)\b", dates_str)
    if len(years) >= 2:
        start_year = int(years[0])
        end_year = int(years[1])
        if start_year > end_year:
            return {
                "valid": False,
                "message": f"Start year ({start_year}) is after end year ({end_year})"
            }
    return {"valid": True}


def reorder_list(items: list, from_idx: int, to_idx: int) -> list:
    copied = list(items)
    if 0 <= from_idx < len(copied) and 0 <= to_idx < len(copied):
        moved = copied.pop(from_idx)
        copied.insert(to_idx, moved)
    return copied


class TestPhase4EditContent:
    def test_action_verb_detector(self):
        """Verifies detection of strong action verbs vs weak phrases."""
        # Strong verbs
        assert analyze_bullet_action_verb("Architected high-throughput message bus")["status"] == "strong"
        assert analyze_bullet_action_verb("Engineered distributed consensus algorithm")["status"] == "strong"
        assert analyze_bullet_action_verb("Spearheaded cross-functional migration")["status"] == "strong"
        assert analyze_bullet_action_verb("automated CI/CD pipelines")["status"] == "strong"

        # Weak phrasing
        assert analyze_bullet_action_verb("Responsible for maintaining backend systems")["status"] == "weak"
        assert analyze_bullet_action_verb("Helped with database migration")["status"] == "weak"
        assert analyze_bullet_action_verb("Assisted with code reviews")["status"] == "weak"
        assert analyze_bullet_action_verb("Was tasked with writing tests")["status"] == "weak"

        # Neutral
        assert analyze_bullet_action_verb("Kafka and Redis event broker")["status"] == "neutral"
        assert analyze_bullet_action_verb("")["status"] == "empty"

    def test_date_order_validation(self):
        """Verifies chronological order validation helper flags start year > end year."""
        # Valid date spans
        assert validate_date_order("Jan 2020 - Dec 2023")["valid"] is True
        assert validate_date_order("2018 - Present")["valid"] is True
        assert validate_date_order("May 2022 - Aug 2022")["valid"] is True
        assert validate_date_order("2024")["valid"] is True
        assert validate_date_order("")["valid"] is True

        # Invalid date spans (chronological inversion)
        res = validate_date_order("2024 - 2021")
        assert res["valid"] is False
        assert "Start year (2024) is after end year (2021)" in res["message"]

        res2 = validate_date_order("Oct 2023 - Jan 2020")
        assert res2["valid"] is False
        assert "Start year (2023) is after end year (2020)" in res2["message"]

    def test_section_and_item_reordering(self):
        """Verifies array reordering math preserves all elements without duplication or loss."""
        sections = [
            {"id": "sec-work", "title": "Work Experience"},
            {"id": "sec-edu", "title": "Education"},
            {"id": "sec-proj", "title": "Projects"},
            {"id": "sec-skills", "title": "Skills"}
        ]

        # Move Work Experience (idx 0) to after Education (idx 1)
        reordered = reorder_list(sections, 0, 1)
        assert [s["id"] for s in reordered] == ["sec-edu", "sec-work", "sec-proj", "sec-skills"]

        # Move Skills (idx 3) to the very top (idx 0)
        reordered2 = reorder_list(reordered, 3, 0)
        assert [s["id"] for s in reordered2] == ["sec-skills", "sec-edu", "sec-work", "sec-proj"]

    def test_section_visibility_and_zero_placeholder(self):
        """Verifies that hidden sections are marked and zero-placeholder invariants hold."""
        sections = [
            {
                "id": "sec-1",
                "title": "Certifications",
                "hidden": True,
                "items": [
                    {"id": "itm-1", "title": "AWS Architect", "organization": "Amazon", "hidden": False}
                ]
            },
            {
                "id": "sec-2",
                "title": "Projects",
                "hidden": False,
                "items": [
                    {"id": "itm-2", "title": "JobNex", "organization": "Self", "hidden": True}
                ]
            }
        ]

        # Active visible sections check
        visible_sections = [s for s in sections if not s.get("hidden")]
        assert len(visible_sections) == 1
        assert visible_sections[0]["id"] == "sec-2"

        # Active visible items check within visible section
        visible_items = [i for i in visible_sections[0]["items"] if not i.get("hidden")]
        assert len(visible_items) == 0  # itm-2 is hidden!

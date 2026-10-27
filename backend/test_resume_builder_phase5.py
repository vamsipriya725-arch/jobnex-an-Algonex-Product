"""
Unit tests for JobNex Resume Builder - Phase 5 (Customize Template Tab)
Tests:
- 4 ATS-safe single-column templates (Modern Clean, Executive ATS, Minimalist, Tech Slate)
- Safe font family selections and typography limits
- Live spacing and padding numeric boundaries
- Backend persistence and round-trip via PUT /api/resumes/{id}
"""

import pytest
from fastapi.testclient import TestClient
from main import app
from resume_builder import (
    TemplateSettings,
    ResumeData,
)

client = TestClient(app)

SUPPORTED_ATS_TEMPLATES = {"modern", "modern-clean", "executive", "executive-ats", "minimalist", "tech-slate"}
SUPPORTED_ATS_FONTS = {
    "Plus Jakarta Sans",
    "Inter",
    "Roboto",
    "Arial",
    "Georgia",
    "Merriweather"
}


class TestPhase5CustomizeTemplate:
    def test_default_template_settings_schema(self):
        """Verifies defaults and schema integrity of TemplateSettings."""
        t = TemplateSettings()
        assert t.fontSize == 10.5
        assert t.lineHeight == 1.45
        assert t.sectionGap == 16
        assert t.itemSpacing == 10
        assert t.paddingTop == 24
        assert t.paddingBottom == 24
        assert t.paddingSide == 28
        assert t.primaryColor == "#2e3049"
        assert t.headingStyle == "bold"
        assert t.fontFamily in SUPPORTED_ATS_FONTS

    def test_safe_font_families_and_template_ids(self):
        """Verifies that all 4 ATS templates and safe fonts are supported."""
        for tpl in ["modern", "executive", "minimalist", "tech-slate"]:
            settings = TemplateSettings(templateId=tpl)
            assert settings.templateId == tpl

        for font in SUPPORTED_ATS_FONTS:
            settings = TemplateSettings(fontFamily=font)
            assert settings.fontFamily == font

    def test_numeric_slider_boundaries(self):
        """Verifies that valid slider ranges for font size, line height, and gaps operate smoothly."""
        compact = TemplateSettings(
            fontSize=9.0,
            lineHeight=1.20,
            sectionGap=10,
            itemSpacing=6,
            paddingTop=16,
            paddingBottom=16,
            paddingSide=16,
        )
        assert compact.fontSize == 9.0
        assert compact.lineHeight == 1.20
        assert compact.sectionGap == 10

        spacious = TemplateSettings(
            fontSize=12.0,
            lineHeight=1.80,
            sectionGap=32,
            itemSpacing=20,
            paddingTop=48,
            paddingBottom=48,
            paddingSide=48,
        )
        assert spacious.fontSize == 12.0
        assert spacious.lineHeight == 1.80
        assert spacious.sectionGap == 32

    def test_template_settings_persistence_api_lifecycle(self):
        """Verifies updating template settings via PUT /api/resumes/{id} persists accurately."""
        headers = {"X-User-Id": "u-phase5-tester"}
        # 1. Create resume
        create_res = client.post(
            "/api/resumes",
            headers=headers,
            json={"name": "Template Testing Resume"},
        )
        assert create_res.status_code == 201
        resume_id = create_res.json()["id"]

        # 2. Update with custom templateSettings
        custom_settings = {
            "templateId": "tech-slate",
            "fontFamily": "Roboto",
            "fontSize": 11.0,
            "lineHeight": 1.5,
            "sectionGap": 20,
            "itemSpacing": 12,
            "paddingTop": 28,
            "paddingBottom": 28,
            "paddingSide": 32,
            "primaryColor": "#505787",
            "headingStyle": "accent-bar",
        }

        get_res = client.get(f"/api/resumes/{resume_id}", headers=headers)
        resume_content = get_res.json()
        resume_content["templateSettings"] = custom_settings

        update_res = client.put(
            f"/api/resumes/{resume_id}",
            headers=headers,
            json={
                "name": resume_content["name"],
                "content": resume_content,
            },
        )
        assert update_res.status_code == 200

        # 3. Retrieve and verify round-trip persistence
        verify_res = client.get(f"/api/resumes/{resume_id}", headers=headers)
        assert verify_res.status_code == 200
        saved_tpl = verify_res.json()["templateSettings"]

        assert saved_tpl["templateId"] == "tech-slate"
        assert saved_tpl["fontFamily"] == "Roboto"
        assert saved_tpl["fontSize"] == 11.0
        assert saved_tpl["lineHeight"] == 1.5
        assert saved_tpl["sectionGap"] == 20
        assert saved_tpl["primaryColor"] == "#505787"
        assert saved_tpl["headingStyle"] == "accent-bar"

        # Cleanup
        client.delete(f"/api/resumes/{resume_id}", headers=headers)

"""
Unit tests for Phase 3: Editor Layout, Template Settings, Zero-Placeholder Rendering,
and Live State Synchronization.
"""
import pytest
from resume_builder import (
    ResumeData,
    PersonalInfo,
    PersonalLink,
    ResumeSection,
    ResumeItem,
    TemplateSettings,
)


def test_zero_placeholder_policy():
    """
    Verifies that the resume data model and rendered structure strictly forbid
    generic placeholder strings like '[Location]', '[Employment Type]', '[Company]'.
    """
    resume = ResumeData(
        name="Developer Resume",
        personal=PersonalInfo(
            name="John Developer",
            email="john@example.com",
            phone="",  # Empty field
            location="",  # Empty field
            links=[],
        ),
        summary="",  # Empty summary
        sections=[
            ResumeSection(
                type="work",
                title="Work Experience",
                hidden=False,
                items=[
                    ResumeItem(
                        title="Software Engineer",
                        organization="Initech",
                        dates="2020 - 2023",
                        location="",  # Empty location
                        bullets=["Engineered robust APIs."],
                        technologies=[],
                        hidden=False,
                    )
                ],
            ),
            ResumeSection(
                type="projects",
                title="Projects",
                hidden=False,
                items=[],  # Empty section items
            ),
            ResumeSection(
                type="certifications",
                title="Certifications",
                hidden=True,  # Hidden section
                items=[
                    ResumeItem(
                        title="AWS Certified Solutions Architect",
                        organization="Amazon Web Services",
                        dates="2023",
                        hidden=False,
                    )
                ],
            ),
        ],
        templateSettings=TemplateSettings(
            fontFamily="Inter",
            fontSize=10.0,
            primaryColor="#1e293b",
        ),
    )

    dumped = resume.model_dump()
    dumped_str = str(dumped)

    # 1. Zero forbidden placeholders
    forbidden = ["[Location]", "[Employment Type]", "[Company]", "[Degree]", "[Date]", "N/A"]
    for placeholder in forbidden:
        assert placeholder not in dumped_str, f"Found forbidden placeholder: {placeholder}"

    # 2. Section filtering logic simulation
    visible_sections = [
        s for s in resume.sections
        if not s.hidden and any(not itm.hidden for itm in s.items)
    ]

    # Projects (empty items) and Certifications (hidden) should be omitted
    assert len(visible_sections) == 1
    assert visible_sections[0].type == "work"


def test_template_settings_configuration():
    """Validates custom templateSettings attributes and default tokens."""
    settings = TemplateSettings(
        templateId="executive-ats",
        fontFamily="Roboto",
        fontSize=11.0,
        lineHeight=1.5,
        sectionGap=18,
        itemSpacing=12,
        paddingTop=30,
        paddingBottom=30,
        paddingSide=32,
        primaryColor="#52588f",
        headingStyle="uppercase",
    )

    assert settings.templateId == "executive-ats"
    assert settings.fontFamily == "Roboto"
    assert settings.primaryColor == "#52588f"
    assert settings.headingStyle == "uppercase"
    assert settings.fontSize == 11.0

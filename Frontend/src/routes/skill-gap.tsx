import { createFileRoute } from "@tanstack/react-router";
import { SkillGapView } from "@/frontend/views/SkillGapView";

export const Route = createFileRoute("/skill-gap")({
  head: () => ({
    meta: [
      { title: "Skill Gap Analysis | JobNex" },
      {
        name: "description",
        content: "Compare your skills to target roles and get course recommendations.",
      },
      { property: "og:title", content: "Skill Gap Analysis | JobNex" },
      {
        property: "og:description",
        content: "Compare your skills to target roles and get course recommendations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SkillGapView,
});

import { createFileRoute } from "@tanstack/react-router";
import { ResumePrivacyView } from "@/frontend/views/ResumePrivacyView";

export const Route = createFileRoute("/resume-privacy")({
  head: () => ({
    meta: [
      { title: "Resume Privacy | JobNex" },
      { name: "description", content: "Control who can see your resume and personal details." },
      { property: "og:title", content: "Resume Privacy | JobNex" },
      {
        property: "og:description",
        content: "Control who can see your resume and personal details.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResumePrivacyView,
});

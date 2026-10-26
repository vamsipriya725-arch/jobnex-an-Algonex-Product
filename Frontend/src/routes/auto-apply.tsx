import { createFileRoute } from "@tanstack/react-router";
import { AutoApplyView } from "@/frontend/views/AutoApplyView";

export const Route = createFileRoute("/auto-apply")({
  head: () => ({
    meta: [
      { title: "Auto-Apply Queue | JobNex" },
      {
        name: "description",
        content: "Queue matching jobs and let JobNex apply for you automatically.",
      },
      { property: "og:title", content: "Auto-Apply Queue | JobNex" },
      {
        property: "og:description",
        content: "Queue matching jobs and let JobNex apply for you automatically.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AutoApplyView,
});

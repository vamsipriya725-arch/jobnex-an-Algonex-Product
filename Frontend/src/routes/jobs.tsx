import { createFileRoute } from "@tanstack/react-router";
import { JobsView } from "@/frontend/views/JobsView";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "Job Search | JobNex" },
      {
        name: "description",
        content: "Search and filter jobs by region, experience level and skills.",
      },
      { property: "og:title", content: "Job Search | JobNex" },
      {
        property: "og:description",
        content: "Search and filter jobs by region, experience level and skills.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JobsView,
});

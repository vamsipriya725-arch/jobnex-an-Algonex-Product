import { createFileRoute } from "@tanstack/react-router";
import { ResourcesView } from "@/frontend/views/ResourcesView";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Resources | JobNex" },
      {
        name: "description",
        content: "Practical guides, templates and tools to support every step of your job search.",
      },
      { property: "og:title", content: "Resources | JobNex" },
      {
        property: "og:description",
        content: "Practical guides, templates and tools to support every step of your job search.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResourcesView,
});

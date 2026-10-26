import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/frontend/views/DashboardView";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | JobNex" },
      {
        name: "description",
        content: "Track your job applications and their status in one place.",
      },
      { property: "og:title", content: "Dashboard | JobNex" },
      {
        property: "og:description",
        content: "Track your job applications and their status in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardView,
});

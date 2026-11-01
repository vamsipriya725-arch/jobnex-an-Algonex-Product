import { createFileRoute } from "@tanstack/react-router";
import { HomeView } from "@/frontend/views/HomeView";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JobNex - AI Career Platform" },
      {
        name: "description",
        content:
          "AI career platform with job search, auto-apply, interview simulator, skill gap diagnostics and cold referrals.",
      },
      { property: "og:title", content: "JobNex - AI Career Platform" },
      {
        property: "og:description",
        content:
          "AI career platform with job search, auto-apply, interview simulator, skill gap diagnostics and cold referrals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomeView,
});

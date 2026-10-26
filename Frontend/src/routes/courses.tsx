import { createFileRoute } from "@tanstack/react-router";
import { CoursesView } from "@/frontend/views/CoursesView";

export const Route = createFileRoute("/courses")({
  head: () => ({
    meta: [
      { title: "Courses | JobNex" },
      {
        name: "description",
        content: "Structured learning programs that build the skills top tech employers ask for.",
      },
      { property: "og:title", content: "Courses | JobNex" },
      {
        property: "og:description",
        content: "Structured learning programs that build the skills top tech employers ask for.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoursesView,
});

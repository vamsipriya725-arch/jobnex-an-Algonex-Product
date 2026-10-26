import { createFileRoute } from "@tanstack/react-router";
import { InterviewPrepView } from "@/frontend/views/InterviewPrepView";

export const Route = createFileRoute("/interview-prep")({
  head: () => ({
    meta: [
      { title: "Interview Prep Simulator | JobNex" },
      {
        name: "description",
        content: "Practice interview questions and get instant feedback on your answers.",
      },
      { property: "og:title", content: "Interview Prep Simulator | JobNex" },
      {
        property: "og:description",
        content: "Practice interview questions and get instant feedback on your answers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InterviewPrepView,
});

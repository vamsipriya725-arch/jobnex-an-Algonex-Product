import { createFileRoute } from "@tanstack/react-router";
import { JobDetailsView } from "@/frontend/views/JobDetailsView";

export const Route = createFileRoute("/jobs/$id")({
  head: () => ({
    meta: [
      { title: "Job Details | JobNex" },
      {
        name: "description",
        content: "View comprehensive job requirements, compensation, and apply on JobNex.",
      },
    ],
  }),
  component: JobDetailsView,
});

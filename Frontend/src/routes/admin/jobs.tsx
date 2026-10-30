import { createFileRoute } from "@tanstack/react-router";
import { AdminJobsView } from "@/frontend/views/AdminJobsView";

export const Route = createFileRoute("/admin/jobs")({
  head: () => ({
    meta: [
      { title: "Admin Job Management | JobNex" },
      {
        name: "description",
        content: "Post, edit, and bulk-upload job openings for JobNex candidates.",
      },
    ],
  }),
  component: AdminJobsView,
});


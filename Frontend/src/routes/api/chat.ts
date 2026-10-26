import { createFileRoute } from "@tanstack/react-router";

import { handleCareerAgent } from "@/lib/lovable-ai.server";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: ({ request }) => handleCareerAgent(request),
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { AIAssistantView } from "@/frontend/views/AIAssistantView";

export const Route = createFileRoute("/ai-assistant")({
  head: () => ({
    meta: [
      { title: "AI Career Assistant | JobNex" },
      {
        name: "description",
        content: "Chat with an AI career assistant for job search and resume advice.",
      },
      { property: "og:title", content: "AI Career Assistant | JobNex" },
      {
        property: "og:description",
        content: "Chat with an AI career assistant for job search and resume advice.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AIAssistantView,
});

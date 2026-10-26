import { createFileRoute } from "@tanstack/react-router";
import { LoginView } from "@/frontend/views/LoginView";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log In | JobNex" },
      { name: "description", content: "Log in to your JobNex account." },
      { property: "og:title", content: "Log In | JobNex" },
      { property: "og:description", content: "Log in to your JobNex account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginView,
});

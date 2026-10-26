import { createFileRoute } from "@tanstack/react-router";
import { SignUpView } from "@/frontend/views/SignUpView";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign Up | JobNex" },
      { name: "description", content: "Create your free JobNex account." },
      { property: "og:title", content: "Sign Up | JobNex" },
      { property: "og:description", content: "Create your free JobNex account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignUpView,
});

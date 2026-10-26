import { createFileRoute } from "@tanstack/react-router";
import { HomeView } from "@/frontend/views/HomeView";
import { LoginView } from "@/frontend/views/LoginView";
import { useJobNex } from "@/frontend/context/JobNexContext";

function MainIndexComponent() {
  const { isLoggedIn } = useJobNex();
  if (!isLoggedIn) {
    return <LoginView />;
  }
  return <HomeView />;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Jobnex: sign in" },
      {
        name: "description",
        content:
          "AI career platform with job search, auto-apply, interview simulator, skill gap diagnostics and cold referrals.",
      },
      { property: "og:title", content: "Jobnex: sign in" },
      {
        property: "og:description",
        content:
          "AI career platform with job search, auto-apply, interview simulator, skill gap diagnostics and cold referrals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MainIndexComponent,
});

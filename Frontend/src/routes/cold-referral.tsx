import { createFileRoute } from "@tanstack/react-router";
import { ColdReferralView } from "@/frontend/views/ColdReferralView";

export const Route = createFileRoute("/cold-referral")({
  head: () => ({
    meta: [
      { title: "Cold Referral Generator | JobNex" },
      {
        name: "description",
        content: "Generate personalized referral outreach messages to employees.",
      },
      { property: "og:title", content: "Cold Referral Generator | JobNex" },
      {
        property: "og:description",
        content: "Generate personalized referral outreach messages to employees.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ColdReferralView,
});

import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/kasho/dashboard";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Home | Kasho Pay" },
      { name: "description", content: "Your Kasho Pay wallet, balance and transaction history." },
      { property: "og:title", content: "Home | Kasho Pay" },
      { property: "og:description", content: "Your Kasho Pay wallet, balance and transaction history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

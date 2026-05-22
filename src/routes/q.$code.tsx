import { createFileRoute } from "@tanstack/react-router";
import { Route as PortalRoute } from "./portal.c.$code";

// Short branded alias for the customer portal, keeps shared links tidy
// (e.g. quottr.co.uk/q/abc123def456 instead of /portal/c/abc123def456).
// We render the portal directly (instead of redirecting) so social
// crawlers (WhatsApp, iMessage, Slack) receive proper OG metadata
// rather than a bare 307 with no preview content.
export const Route = createFileRoute("/q/$code")({
  component: PortalRoute.options.component,
  head: ({ params }) => ({
    meta: [
      { title: "Your quote from Quottr" },
      {
        name: "description",
        content: "View, accept and pay your quote securely online.",
      },
      { property: "og:title", content: "Your quote is ready to view" },
      {
        property: "og:description",
        content: "Tap to view, accept and pay your quote securely online.",
      },
      { property: "og:image", content: "https://quottr.co.uk/og-quottr.jpg" },
      { name: "twitter:image", content: "https://quottr.co.uk/og-quottr.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      {
        property: "og:url",
        content: `https://quottr.co.uk/q/${params.code}`,
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

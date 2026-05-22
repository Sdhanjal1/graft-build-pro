import { createFileRoute, redirect } from "@tanstack/react-router";

// Short branded alias for the customer portal, keeps shared links tidy
// (e.g. quottr.co.uk/q/abc123def456 instead of /portal/c/abc123def456).
export const Route = createFileRoute("/q/$code")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/portal/c/$code", params: { code: params.code }, replace: true });
  },
});

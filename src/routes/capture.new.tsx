import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/capture/new")({
  beforeLoad: () => {
    throw redirect({ to: "/app" });
  },
});

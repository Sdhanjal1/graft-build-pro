import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/capture/$captureId")({
  beforeLoad: () => {
    throw redirect({ to: "/app" });
  },
});

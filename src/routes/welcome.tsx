import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/welcome")({
  component: () => <Navigate to="/" replace />,
});

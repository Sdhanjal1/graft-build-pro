import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession } from "@/lib/auth";
import { hydrateUserData, userProfile } from "@/lib/user-data";

export const Route = createFileRoute("/welcome")({
  component: WelcomeRedirect,
});

function WelcomeRedirect() {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    (async () => {
      await hydrateUserData();
      if (userProfile.business_name) {
        navigate({ to: "/app", replace: true });
      } else {
        navigate({ to: "/onboarding", replace: true });
      }
    })();
  }, [loading, session, navigate]);

  return null;
}

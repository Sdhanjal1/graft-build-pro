import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth";
import { hydrateUserData, userProfile } from "@/lib/user-data";

export const Route = createFileRoute("/confirmed")({
  component: ConfirmedPage,
});

function ConfirmedPage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      await hydrateUserData();
      if (cancelled) return;
      setReady(true);
      const dest = userProfile.business_name ? "/app" : "/onboarding";
      const t = setTimeout(() => navigate({ to: dest, replace: true }), 1500);
      return () => clearTimeout(t);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, session, navigate]);

  const goNow = async () => {
    await hydrateUserData();
    const dest = userProfile.business_name ? "/app" : "/onboarding";
    navigate({ to: dest, replace: true });
  };

  return (
    <div className="min-h-screen bg-ink text-paper flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, color-mix(in oklab, var(--lime) 35%, transparent), transparent 55%)",
        }}
      />
      <div className="relative text-center max-w-sm">
        <h1
          className="text-lime leading-[0.8] tracking-tight mb-6"
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(4rem, 22vw, 6rem)" }}
        >
          Quottr.
        </h1>
        <p className="text-xl font-semibold mb-2">Thanks — your email is confirmed</p>
        <p className="text-sm text-paper/60 mb-8">
          {ready ? "Taking you to setup…" : "One moment…"}
        </p>
        <button
          onClick={goNow}
          className="bg-lime text-ink rounded-full px-8 py-3.5 font-bold"
        >
          Get started
        </button>
      </div>
    </div>
  );
}

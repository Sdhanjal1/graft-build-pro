import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useSession } from "@/lib/auth";
import { hydrateUserData, userProfile } from "@/lib/user-data";

export const Route = createFileRoute("/confirmed")({
  component: ConfirmedPage,
});

function ConfirmedPage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [dest, setDest] = useState<"/onboarding" | "/app">("/onboarding");

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      await hydrateUserData();
      if (cancelled) return;
      const target = userProfile.business_name ? "/app" : "/onboarding";
      setDest(target);
      timer = setTimeout(() => navigate({ to: target, replace: true }), 1500);
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [loading, session, navigate]);

  const goNow = async () => {
    await hydrateUserData();
    const target = userProfile.business_name ? "/app" : "/onboarding";
    navigate({ to: target, replace: true });
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
      <div className="relative text-center max-w-sm flex flex-col items-center">
        <h1
          className="text-lime leading-[0.8] tracking-tight mb-6"
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(3rem, 14vw, 4.5rem)" }}
        >
          Quottr.
        </h1>
        <div className="w-20 h-20 rounded-full bg-lime flex items-center justify-center mb-6 shadow-[0_0_40px_color-mix(in_oklab,var(--lime)_50%,transparent)]">
          <Check className="w-10 h-10 text-ink" strokeWidth={3} />
        </div>
        <h2 className="text-2xl font-bold mb-2">Email confirmed</h2>
        <p className="text-sm text-paper/85 mb-5">
          You're all set. Let's get your account ready.
        </p>
        <button
          onClick={goNow}
          className="bg-lime text-ink rounded-full px-8 py-3.5 font-bold"
        >
          Continue
        </button>
        <p className="mt-4 text-xs text-paper/75">
          Taking you to {dest === "/app" ? "your dashboard" : "setup"}…
        </p>
      </div>
    </div>
  );
}

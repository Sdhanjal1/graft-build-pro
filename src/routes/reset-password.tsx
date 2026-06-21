import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Set a new password, Quottr" },
    ],
  }),
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  // Supabase parses the recovery token from the URL hash automatically and emits PASSWORD_RECOVERY.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      navigate({ to: "/app" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink text-paper flex flex-col relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ background: "radial-gradient(circle at 50% 0%, color-mix(in oklab, var(--lime) 35%, transparent), transparent 55%)" }}
      />
      <div className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full relative">
        <div className="mb-6 text-center">
          <h1
            className="text-lime leading-[0.8] tracking-tight"
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(3rem, 14vw, 5rem)" }}
          >
            New password
          </h1>
          <p className="text-paper/70 mt-3 text-sm">Pick something strong. At least 8 characters.</p>
        </div>

        {!ready ? (
          <p className="text-sm text-paper/70 text-center">
            Open this page from the link in the reset email. If it's not working,{" "}
            <Link to="/forgot-password" className="text-lime font-semibold">request a new link</Link>.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-paper/85 font-semibold">New password</span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 w-full bg-paper/10 border border-paper/15 rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-lime/50 placeholder:text-paper/30"
              />
            </label>
            {error && <p className="text-xs text-status-overdue font-medium">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-lime text-ink rounded-full py-4 font-bold mt-3 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Update password"}
            </button>
          </form>
        )}
      </div>
      <p className="text-center text-[11px] text-paper/75 pb-6">UK tradespeople · 2026</p>
    </div>
  );
}

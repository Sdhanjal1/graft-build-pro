import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({
    meta: [
      { title: "Reset your password, Quottr" },
      { name: "description", content: "Reset the password for your Quottr account." },
    ],
  }),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send reset email");
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
            Reset password
          </h1>
          <p className="text-paper/70 mt-3 text-sm">We'll email you a link to set a new one.</p>
        </div>

        {sent ? (
          <div className="bg-paper/10 border border-paper/15 rounded-2xl p-5 text-sm text-paper/85">
            If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox and spam.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-paper/85 font-semibold">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1.5 w-full bg-paper/10 border border-paper/15 rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-lime/50 placeholder:text-paper/30"
              />
            </label>
            {error && <p className="text-xs text-status-overdue font-medium">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-lime text-ink rounded-full py-4 font-bold mt-3 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <Link to="/auth" className="mt-6 text-sm text-paper/70 text-center w-full block">
          Back to <span className="text-lime font-semibold">sign in</span>
        </Link>
      </div>
      <p className="text-center text-[11px] text-paper/75 pb-6">UK tradespeople · 2026</p>
    </div>
  );
}

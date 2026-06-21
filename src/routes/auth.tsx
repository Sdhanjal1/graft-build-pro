import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { signInWithPassword, signUpWithPassword, signInWithGoogle, useSession } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { session } = useSession();

  useEffect(() => {
    if (session) navigate({ to: "/welcome" });
  }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await signInWithPassword(email, password);
        navigate({ to: "/welcome" });
      } else {
        if (!acceptedTerms) {
          setError("Please accept the Terms & Privacy Policy to continue.");
          setBusy(false);
          return;
        }
        await signUpWithPassword(email, password, fullName);
        // Try to auto sign-in. If email confirmation is required, fall back to a notice.
        try {
          await signInWithPassword(email, password);
          navigate({ to: "/welcome" });
        } catch {
          setError("Account created. Please check your email to confirm, then sign in.");
          setMode("login");
        }

      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    if (mode === "signup" && !acceptedTerms) {
      setError("Please accept the Terms & Privacy Policy to continue.");
      return;
    }
    setGoogleBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setGoogleBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink text-paper flex flex-col relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ background: "radial-gradient(circle at 50% 0%, color-mix(in oklab, var(--lime) 35%, transparent), transparent 55%)" }}
      />
      <div className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full relative py-8">
        <div className="mb-6 text-center">
          <h1
            className="text-lime leading-[0.8] tracking-tight"
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(4.5rem, 28vw, 8rem)" }}
          >
            Quottr.
          </h1>
          <p className="text-paper/70 mt-3 text-sm">Quote in seconds. Get paid faster.</p>
        </div>

        {/* Google button */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleBusy || busy}
          className="w-full bg-paper text-ink rounded-full py-3.5 font-bold flex items-center justify-center gap-3 disabled:opacity-60 mb-4"
        >
          <GoogleIcon />
          {googleBusy ? "Opening Google…" : `Continue with Google`}
        </button>

        <div className="flex items-center gap-3 my-2 text-[10px] uppercase tracking-widest text-paper/75">
          <div className="flex-1 h-px bg-paper/15" />
          or
          <div className="flex-1 h-px bg-paper/15" />
        </div>

        <form onSubmit={submit} className="space-y-3 mt-3">
          {mode === "signup" && (
            <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. John Smith" required />
          )}
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />

          {mode === "signup" && (
            <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-lime"
              />
              <span className="text-[11px] text-paper/70 leading-snug">
                I agree to the{" "}
                <Link to="/terms" className="text-lime underline">Terms of Service</Link>
                {" "}and{" "}
                <Link to="/privacy" className="text-lime underline">Privacy Policy</Link>.
              </span>
            </label>
          )}

          {error && <p className="text-xs text-status-overdue font-medium">{error}</p>}

          <button
            type="submit"
            disabled={busy || googleBusy}
            className="w-full bg-lime text-ink rounded-full py-4 font-bold mt-3 disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        {mode === "login" && (
          <Link to="/forgot-password" className="mt-4 text-xs text-paper/85 hover:text-paper text-center w-full block">
            Forgot password?
          </Link>
        )}

        <button
          type="button"
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
          className="mt-6 text-sm text-paper/70 text-center w-full"
        >
          {mode === "login" ? "New here? " : "Have an account? "}
          <span className="text-lime font-semibold">
            {mode === "login" ? "Create an account" : "Sign in"}
          </span>
        </button>
      </div>
      <p className="text-center text-[11px] text-paper/75 pb-6">UK tradespeople · 2026</p>
    </div>
  );
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-paper/85 font-semibold">{label}</span>
      <input
        {...props}
        className="mt-1.5 w-full bg-paper/10 border border-paper/15 rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-lime/50 placeholder:text-paper/30"
      />
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

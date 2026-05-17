import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import logo from "@/assets/quottr-logo.png";
import { signInWithPassword, signUpWithPassword, useSession } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const navigate = useNavigate();
  const { session } = useSession();

  useEffect(() => {
    if (session) navigate({ to: "/" });
  }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "login") {
        await signInWithPassword(email, password);
        navigate({ to: "/" });
      } else {
        await signUpWithPassword(email, password, fullName);
        setInfo("Account created — you can sign in now.");
        setMode("login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink text-paper flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full">
        <div className="mb-10">
          <img src={logo} alt="Quottr" className="h-16 w-auto mb-5" />
          <p className="text-paper/70 mt-2 text-sm">Quote in seconds. Get paid faster.</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nav Dhanjal" />
          )}
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@trade.co.uk" required />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />

          {error && <p className="text-xs text-status-overdue font-medium">{error}</p>}
          {info && <p className="text-xs text-lime font-medium">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-lime text-ink rounded-full py-4 font-bold mt-3 disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setInfo(null); }}
          className="mt-6 text-sm text-paper/70 text-center w-full"
        >
          {mode === "login" ? "New here? " : "Have an account? "}
          <span className="text-lime font-semibold">
            {mode === "login" ? "Create an account" : "Sign in"}
          </span>
        </button>
      </div>
      <p className="text-center text-[11px] text-paper/40 pb-6">UK tradespeople · 2026</p>
    </div>
  );
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-paper/60 font-semibold">{label}</span>
      <input
        {...props}
        className="mt-1.5 w-full bg-paper/10 border border-paper/15 rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-lime/50 placeholder:text-paper/30"
      />
    </label>
  );
}

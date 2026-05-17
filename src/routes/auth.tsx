import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import logo from "@/assets/quottr-logo.png";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-ink text-paper flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full">
        <div className="mb-10">
          <img src={logo} alt="Quottr" className="h-16 w-auto mb-5" />
          <p className="text-paper/70 mt-2 text-sm">Quote in seconds. Get paid faster.</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/" });
          }}
          className="space-y-3"
        >
          {mode === "signup" && (
            <Input label="Full name" placeholder="Nav Dhanjal" />
          )}
          <Input label="Email" type="email" placeholder="you@trade.co.uk" />
          <Input label="Password" type="password" placeholder="••••••••" />

          <button
            type="submit"
            className="w-full bg-lime text-ink rounded-full py-4 font-bold mt-3"
          >
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
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

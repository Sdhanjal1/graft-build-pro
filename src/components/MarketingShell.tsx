import { Link } from "@tanstack/react-router";
import { QuottrWordmark } from "@/components/QuottrLogo";
import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";

const nav = [
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Pricing" },
  { to: "/trades", label: "Trades" },
  { to: "/faqs", label: "FAQs" },
  { to: "/about", label: "About" },
] as const;

export function MarketingShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-dvh bg-paper text-ink flex flex-col">
      <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur border-b border-ink/10">
        <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <QuottrWordmark className="text-2xl" />
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="text-ink/70 hover:text-ink transition-colors"
                activeProps={{ className: "text-ink" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth" className="text-sm font-medium text-ink/70 hover:text-ink">
              Log in
            </Link>
            <Link
              to="/auth"
              className="text-sm font-semibold bg-ink text-paper px-4 py-2 rounded-full hover:bg-ink/90 transition-colors"
            >
              Get started
            </Link>
          </div>
          <button
            type="button"
            className="md:hidden h-10 w-10 -mr-2 flex items-center justify-center rounded-full hover:bg-ink/5"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="md:hidden border-t border-ink/10 bg-paper">
            <div className="px-5 py-4 flex flex-col gap-3">
              {nav.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="text-base font-medium text-ink/80 py-1"
                >
                  {n.label}
                </Link>
              ))}
              <div className="h-px bg-ink/10 my-2" />
              <Link to="/auth" onClick={() => setOpen(false)} className="text-base font-medium text-ink/80 py-1">
                Log in
              </Link>
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="text-center text-sm font-semibold bg-ink text-paper px-4 py-3 rounded-full"
              >
                Get started
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-ink/10 bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-5 py-12 grid gap-8 md:grid-cols-3">
          <div>
            <QuottrWordmark className="text-2xl text-paper" />
            <p className="mt-3 text-sm text-paper/60 max-w-xs">
              Quote in seconds. Get paid faster. Built for tradespeople.
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-paper/50 font-semibold mb-3">Product</p>
            <ul className="space-y-2 text-sm">
              <li><Link to="/welcome" className="text-paper/80 hover:text-lime">Features</Link></li>
              <li><Link to="/pricing" className="text-paper/80 hover:text-lime">Pricing</Link></li>
              <li><Link to="/auth" className="text-paper/80 hover:text-lime">Sign up</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-paper/50 font-semibold mb-3">Company</p>
            <ul className="space-y-2 text-sm">
              <li><Link to="/about" className="text-paper/80 hover:text-lime">About</Link></li>
              <li><a href="mailto:hello@quottr.app" className="text-paper/80 hover:text-lime">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-paper/10">
          <div className="mx-auto max-w-6xl px-5 py-5 text-xs text-paper/50 flex flex-col md:flex-row justify-between gap-2">
            <span>© {new Date().getFullYear()} Quottr. All rights reserved.</span>
            <span>Made for the trades.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { QuottrWordmark } from "@/components/QuottrLogo";
import { CookieBanner } from "@/components/CookieBanner";
import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";

const nav = [
  { to: "/", label: "Home" },
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
        <div className="mx-auto max-w-6xl px-5 py-12 grid gap-8 md:grid-cols-4">
          <div>
            <QuottrWordmark className="text-2xl" />
            <p className="mt-3 text-sm text-paper/60 max-w-xs">
              Quote in seconds. Get paid faster. Built for tradespeople.
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-paper/50 font-semibold mb-3">Product</p>
            <ul className="space-y-2 text-sm">
              <li><Link to="/features" className="text-paper/80 hover:text-lime">Features</Link></li>
              <li><Link to="/pricing" className="text-paper/80 hover:text-lime">Pricing</Link></li>
              <li><Link to="/auth" className="text-paper/80 hover:text-lime">Sign up</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-paper/50 font-semibold mb-3">Company</p>
            <ul className="space-y-2 text-sm">
              <li><Link to="/about" className="text-paper/80 hover:text-lime">About</Link></li>
              <li><a href="mailto:hello@quottr.co.uk" className="text-paper/80 hover:text-lime">Contact</a></li>
              <li><Link to="/privacy" className="text-paper/80 hover:text-lime">Privacy</Link></li>
              <li><Link to="/terms" className="text-paper/80 hover:text-lime">Terms</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-paper/50 font-semibold mb-3">Follow Quottr</p>
            <div className="flex items-center gap-4">
              {/* Social links — update hrefs once accounts are live */}
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Quottr on TikTok"
                className="text-lime hover:scale-110 transition-transform duration-200"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12a4 4 0 1 0 4 4V4c.5.5 2 1.5 3.5 1.5" />
                </svg>
              </a>
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Quottr on Instagram"
                className="text-lime hover:scale-110 transition-transform duration-200"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <circle cx="12" cy="12" r="5" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Quottr on Facebook"
                className="text-lime hover:scale-110 transition-transform duration-200"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </a>
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Quottr on YouTube"
                className="text-lime hover:scale-110 transition-transform duration-200"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2.1A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2-.1A2 2 0 0 1 2.5 17z" />
                  <polygon points="10 15 15 12 10 9" fill="currentColor" stroke="none" />
                </svg>
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-paper/10">
          <div className="mx-auto max-w-6xl px-5 py-5 text-xs text-paper/50 flex flex-col md:flex-row justify-between gap-2">
            <span>© {new Date().getFullYear()} Quottr. All rights reserved.</span>
            <span className="flex gap-4">
              <Link to="/privacy" className="hover:text-paper">Privacy</Link>
              <Link to="/terms" className="hover:text-paper">Terms</Link>
            </span>
          </div>
        </div>
      </footer>
      <CookieBanner />
    </div>
  );
}

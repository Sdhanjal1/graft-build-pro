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
            <p className="mt-3 text-sm text-paper/85 max-w-xs">
              Quote in seconds. Get paid faster. Built for tradespeople.
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-paper/80 font-semibold mb-3">Product</p>
            <ul className="space-y-2 text-sm">
              <li><Link to="/features" className="text-paper/80 hover:text-lime">Features</Link></li>
              <li><Link to="/pricing" className="text-paper/80 hover:text-lime">Pricing</Link></li>
              <li><Link to="/merch" className="text-paper/80 hover:text-lime">Shop</Link></li>
              <li><Link to="/auth" className="text-paper/80 hover:text-lime">Sign up</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-paper/80 font-semibold mb-3">Company</p>
            <ul className="space-y-2 text-sm">
              <li><Link to="/about" className="text-paper/80 hover:text-lime">About</Link></li>
              <li><a href="mailto:hello@quottr.co.uk" className="text-paper/80 hover:text-lime">Contact</a></li>
              <li><Link to="/privacy" className="text-paper/80 hover:text-lime">Privacy</Link></li>
              <li><Link to="/terms" className="text-paper/80 hover:text-lime">Terms</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-paper/80 font-semibold mb-3">Follow Quottr</p>
            <div className="flex items-center gap-4">
              {/* Social links — update hrefs once accounts are live */}
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Quottr on TikTok"
                className="text-lime hover:text-lime/80 hover:scale-105 transition-all duration-200"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.84a8.16 8.16 0 0 0 4.77 1.52V6.93a4.85 4.85 0 0 1-1.84-.24z" />
                </svg>
              </a>
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Quottr on Instagram"
                className="text-lime hover:text-lime/80 hover:scale-105 transition-all duration-200"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" clipRule="evenodd" aria-hidden="true">
                  <path d="M12 2c-2.717 0-3.056.012-4.123.06-1.064.049-1.791.218-2.427.465a4.902 4.902 0 0 0-1.772 1.153A4.902 4.902 0 0 0 2.525 5.45c-.247.636-.416 1.363-.465 2.427C2.012 8.944 2 9.283 2 12s.012 3.056.06 4.123c.049 1.064.218 1.791.465 2.427a4.902 4.902 0 0 0 1.153 1.772 4.902 4.902 0 0 0 1.772 1.153c.636.247 1.363.416 2.427.465C8.944 21.988 9.283 22 12 22s3.056-.012 4.123-.06c1.064-.049 1.791-.218 2.427-.465a4.902 4.902 0 0 0 1.772-1.153 4.902 4.902 0 0 0 1.153-1.772c.247-.636.416-1.363.465-2.427.048-1.067.06-1.406.06-4.123s-.012-3.056-.06-4.123c-.049-1.064-.218-1.791-.465-2.427a4.902 4.902 0 0 0-1.153-1.772A4.902 4.902 0 0 0 18.55 2.525c-.636-.247-1.363-.416-2.427-.465C15.056 2.012 14.717 2 12 2zm0 1.802c2.67 0 2.987.01 4.042.058.976.045 1.505.207 1.858.344.466.181.8.398 1.15.748.35.35.566.683.747 1.15.137.352.3.882.344 1.857.048 1.055.058 1.37.058 4.042 0 2.67-.01 2.987-.058 4.042-.045.976-.207 1.505-.344 1.858a3.097 3.097 0 0 1-.748 1.15c-.35.35-.683.566-1.15.747-.352.137-.882.3-1.857.344-1.054.048-1.37.058-4.042.058-2.67 0-2.987-.01-4.041-.058-.976-.045-1.505-.207-1.858-.344a3.097 3.097 0 0 1-1.15-.748 3.097 3.097 0 0 1-.748-1.15c-.137-.352-.3-.882-.344-1.857-.048-1.055-.058-1.37-.058-4.042 0-2.67.01-2.987.058-4.041.045-.976.207-1.505.344-1.858.181-.466.398-.8.748-1.15.35-.35.683-.566 1.15-.747.353-.137.882-.3 1.858-.344 1.054-.048 1.37-.058 4.041-.058zM12 6.865a5.135 5.135 0 1 0 0 10.27 5.135 5.135 0 0 0 0-10.27zm0 8.468a3.333 3.333 0 1 1 0-6.666 3.333 3.333 0 0 1 0 6.666zm6.538-8.671a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z" />
                </svg>
              </a>
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Quottr on Facebook"
                className="text-lime hover:text-lime/80 hover:scale-105 transition-all duration-200"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Quottr on YouTube"
                className="text-lime hover:text-lime/80 hover:scale-105 transition-all duration-200"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" clipRule="evenodd" aria-hidden="true">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.546 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-paper/10">
          <div className="mx-auto max-w-6xl px-5 py-5 text-xs text-paper/80 flex flex-col md:flex-row justify-between gap-2">
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

import { Link, useRouterState } from "@tanstack/react-router";
import { Mic } from "lucide-react";

const HIDE_PREFIXES = ["/auth", "/welcome", "/pricing", "/about", "/portal/", "/request/", "/capture"];
const HIDE_EXACT = new Set(["/quotes/new"]);

export function FloatingMicButton() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (HIDE_EXACT.has(pathname)) return null;
  if (HIDE_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <Link
      to="/quotes/new"
      search={{ voice: 1 }}
      aria-label="Start a voice quote"
      className="fixed bottom-24 right-4 z-50 h-14 w-14 rounded-full bg-lime flex items-center justify-center shadow-[0_10px_24px_-6px_rgba(200,224,74,0.6)] ring-4 ring-paper active:scale-95 transition"
    >
      <Mic className="h-6 w-6 text-ink" strokeWidth={2.5} />
    </Link>
  );
}

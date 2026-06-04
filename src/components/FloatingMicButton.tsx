import { Link, useRouterState } from "@tanstack/react-router";
import { VoiceWaveform } from "@/components/icons/VoiceIcons";

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
      aria-label="Speak a quote"
      className="fixed bottom-24 right-4 z-50 h-14 pl-4 pr-5 rounded-full bg-lime flex items-center gap-2 shadow-[0_10px_24px_-6px_rgba(200,224,74,0.6)] ring-4 ring-paper active:scale-95 transition"
    >
      <VoiceWaveform size={20} className="text-ink" />
      <span className="text-sm font-bold text-ink">Speak a quote</span>
    </Link>
  );
}

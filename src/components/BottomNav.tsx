import { Link, useRouterState } from "@tanstack/react-router";
import { Home, FileText, Settings, Clock, MessageSquare } from "lucide-react";
import { feedback, playSample } from "@/lib/feedback";

const items = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/quotes", label: "Quotes", icon: FileText },
  { to: "/messages", label: "Inbox", icon: MessageSquare },
  { to: "/chaser", label: "Chasers", icon: Clock },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hide = pathname.startsWith("/auth") || pathname.startsWith("/capture") || pathname.startsWith("/portal/");
  if (hide) return null;

  const isActive = (to: string) => (to === "/app" ? pathname === "/app" : pathname.startsWith(to));

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 safe-bottom">
      <div className="mx-auto max-w-md px-3 pb-3 pt-2">
        <div
          className="relative rounded-full flex items-center justify-around h-16 px-2 overflow-hidden ring-1 ring-white/15 shadow-[0_10px_28px_-10px_rgba(0,0,0,0.55)] backdrop-blur-2xl backdrop-saturate-150 [-webkit-backdrop-filter:blur(24px)_saturate(1.5)]"
          style={{
            background: "linear-gradient(180deg, rgba(30,31,25,0.72) 0%, rgba(22,23,15,0.82) 100%)",
          }}
        >
          {/* top edge highlight — sells the glass */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          {items.map((it) => (
            <NavItem key={it.to} {...it} active={isActive(it.to)} />
          ))}
        </div>
      </div>
    </nav>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      onPointerDown={() => {
        feedback("tap");
        if (!active) playSample("tick");
      }}
      aria-current={active ? "page" : undefined}
      className="flex-1 h-full min-w-0 flex items-center justify-center relative"
    >
      <span
        className={[
          "flex items-center gap-1.5 rounded-full transition-all duration-200 ease-out",
          active
            ? "bg-lime text-ink px-3.5 py-2 shadow-[0_6px_16px_-6px_rgba(200,224,74,0.7)] scale-100"
            : "text-paper/60 px-2 py-2 scale-95",
        ].join(" ")}
      >
        <Icon
          className={active ? "h-[18px] w-[18px]" : "h-5 w-5"}
          strokeWidth={active ? 2.75 : 2}
        />
        {active && (
          <span className="text-[12px] font-bold tracking-tight leading-none whitespace-nowrap">
            {label}
          </span>
        )}
      </span>
      <span className="sr-only">{label}</span>
    </Link>
  );
}

import { Link, useRouterState } from "@tanstack/react-router";
import { Home, FileText, Settings, MessageSquare, BarChart3 } from "lucide-react";

const items = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/messages", label: "Inbox", icon: MessageSquare },
  { to: "/quotes", label: "Quotes", icon: FileText },
  { to: "/insights", label: "Insights", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hide = pathname.startsWith("/auth") || pathname.startsWith("/capture") || pathname.startsWith("/portal/");
  if (hide) return null;

  const isActive = (to: string) =>
    to === "/app" ? pathname === "/app" : pathname.startsWith(to);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 safe-bottom">
      <div className="mx-auto max-w-md px-3 pb-3 pt-2">
        <div className="bg-ink rounded-full shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] flex items-center justify-around h-16 px-1.5">
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
      className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full min-w-0"
    >
      <Icon className={`h-5 w-5 ${active ? "text-lime" : "text-paper/60"}`} strokeWidth={active ? 2.5 : 2} />
      <span className={`text-[9px] font-semibold ${active ? "text-lime" : "text-paper/60"}`}>{label}</span>
    </Link>
  );
}

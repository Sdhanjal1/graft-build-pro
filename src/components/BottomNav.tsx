import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Users, Plus, FileText, Settings } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/quotes", label: "Quotes", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hide = pathname.startsWith("/auth");
  if (hide) return null;

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 safe-bottom">
      <div className="mx-auto max-w-md px-4 pb-3 pt-2">
        <div className="relative bg-ink rounded-full shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] flex items-center justify-around h-16 px-2">
          {items.slice(0, 2).map((it) => (
            <NavItem key={it.to} {...it} active={isActive(it.to)} />
          ))}

          {/* centre + */}
          <Link
            to="/quotes/new"
            aria-label="New quote"
            className="relative -mt-10 h-16 w-16 rounded-full bg-lime flex items-center justify-center shadow-[0_10px_24px_-6px_rgba(200,224,74,0.6)] ring-4 ring-paper active:scale-95 transition"
          >
            <Plus className="h-7 w-7 text-ink" strokeWidth={3} />
          </Link>

          {items.slice(2).map((it) => (
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
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full"
    >
      <Icon className={`h-5 w-5 ${active ? "text-lime" : "text-paper/60"}`} />
      <span className={`text-[10px] font-medium ${active ? "text-lime" : "text-paper/60"}`}>{label}</span>
    </Link>
  );
}

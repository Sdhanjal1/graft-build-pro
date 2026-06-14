import { Link, useRouterState } from "@tanstack/react-router";
import { Home, FileText, Users, Clock, Inbox } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { feedback, playSample } from "@/lib/feedback";
import { getMyIncomingRequests } from "@/lib/quote-requests.functions";
import { useSession } from "@/lib/auth";
import { useKeyboardOpen } from "@/hooks/useKeyboardOpen";

const items = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/quotes", label: "Quotes", icon: FileText },
  { to: "/clients", label: "Customers", icon: Users },
  { to: "/messages", label: "Inbox", icon: Inbox },
  { to: "/chaser", label: "Chasers", icon: Clock },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const keyboardOpen = useKeyboardOpen();
  const hide =
    keyboardOpen ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/capture") ||
    pathname.startsWith("/portal/") ||
    pathname.startsWith("/onboarding") ||
    pathname === "/quotes/new";

  const fetchRequests = useServerFn(getMyIncomingRequests);
  const { session } = useSession();
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["inbox-unread-count"],
    queryFn: () => fetchRequests(),
    enabled: !hide && !!session,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
    retry: false,
    select: (r: { requests: Array<{ read_at: string | null }> }) =>
      r?.requests?.filter((x) => !x.read_at).length ?? 0,
  });

  if (hide) return null;

  const isActive = (to: string) => (to === "/app" ? pathname === "/app" : pathname.startsWith(to));

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 safe-bottom">
      <div className="mx-auto max-w-md px-3 pb-3 pt-2">
        <div
          className="relative rounded-full flex items-center justify-around gap-0.5 h-16 px-1.5 overflow-hidden ring-1 ring-white/15 shadow-[0_10px_28px_-10px_rgba(0,0,0,0.55)] backdrop-blur-2xl backdrop-saturate-150 [-webkit-backdrop-filter:blur(24px)_saturate(1.5)]"
          style={{
            background: "linear-gradient(180deg, rgba(30,31,25,0.72) 0%, rgba(22,23,15,0.82) 100%)",
          }}
        >
          {/* top edge highlight — sells the glass */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          {items.map((it) => (
            <NavItem
              key={it.to}
              {...it}
              active={isActive(it.to)}
              unreadCount={it.to === "/messages" ? unreadCount : 0}
            />
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
  unreadCount = 0,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
  unreadCount?: number;
}) {
  const hasUnread = unreadCount > 0;
  return (
    <Link
      to={to}
      onPointerDown={() => {
        feedback("tap");
        if (!active) playSample("tick");
      }}
      aria-current={active ? "page" : undefined}
      className="h-full min-w-0 shrink-0 flex items-center justify-center relative"
    >
      <span
        className={[
          "relative flex items-center gap-1.5 rounded-full transition-all duration-200 ease-out min-w-0",
          active
            ? "bg-lime text-ink px-3 py-2 shadow-[0_6px_16px_-6px_rgba(200,224,74,0.7)]"
            : "text-paper/60 px-2.5 py-2 scale-95",
        ].join(" ")}
      >
        <span className="relative inline-flex">
          <Icon
            className={active ? "h-[18px] w-[18px]" : "h-5 w-5"}
            strokeWidth={active ? 2.75 : 2}
          />
          {hasUnread && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-lime ring-2 ring-ink"
            />
          )}
        </span>
        {active && (
          <span className="text-[12px] font-bold tracking-tight leading-none whitespace-nowrap truncate min-w-0">
            {label}
          </span>
        )}
      </span>
      <span className="sr-only">
        {hasUnread ? `${label}, ${unreadCount} unread` : label}
      </span>
    </Link>
  );
}

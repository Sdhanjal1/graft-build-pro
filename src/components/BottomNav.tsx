import { Link, useRouterState } from "@tanstack/react-router";
import { Home, FileText, Users, Clock, Inbox } from "lucide-react";
import { useEffect } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { feedback, playSample } from "@/lib/feedback";
import { getMyIncomingRequests } from "@/lib/quote-requests.functions";
import { getUnreadNotificationCount } from "@/lib/notifications.functions";
import { useSession } from "@/lib/auth";
import { useKeyboardOpen } from "@/hooks/useKeyboardOpen";
import { supabase } from "@/integrations/supabase/client";

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
  const fetchNotifCount = useServerFn(getUnreadNotificationCount);
  const { session } = useSession();
  const queryClient = useQueryClient();

  const { data: requestsUnread = 0 } = useQuery({
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

  const { data: notificationsUnread = 0 } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => fetchNotifCount(),
    enabled: !hide && !!session,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    retry: false,
    select: (r: { unreadCount: number }) => r?.unreadCount ?? 0,
  });

  // Realtime: bump notification count on any change for this user.
  useEffect(() => {
    if (hide || !session?.user?.id) return;
    const userId = session.user.id;
    const channel = supabase
      .channel(`inbox-nav:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [hide, session?.user?.id, queryClient]);

  const totalUnread = (requestsUnread ?? 0) + (notificationsUnread ?? 0);

  if (hide) return null;

  const isActive = (to: string) => (to === "/app" ? pathname === "/app" : pathname.startsWith(to));

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40" aria-label="Primary">
      {/* Ink wash covers the safe-area chin too, so the home-indicator strip never shows paper behind the lime pill. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 top-[-40px] bg-gradient-to-t from-ink via-ink/85 to-transparent" />
      <div className="mx-auto max-w-md px-3 pb-3 pt-6 relative safe-bottom">
        <div
          className="relative rounded-full flex items-stretch justify-around gap-0.5 h-[68px] px-1.5 overflow-hidden ring-1 ring-white/15 shadow-[0_10px_28px_-12px_rgba(0,0,0,0.6)] backdrop-blur-2xl backdrop-saturate-150 [-webkit-backdrop-filter:blur(24px)_saturate(1.5)]"
          style={{
            background: "linear-gradient(180deg, rgba(30,31,25,0.78) 0%, rgba(22,23,15,0.88) 100%)",
          }}
        >
          {/* top edge highlight — sells the glass */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          {items.map((it) => (
            <NavItem
              key={it.to}
              {...it}
              active={isActive(it.to)}
              unreadCount={it.to === "/messages" ? totalUnread : 0}
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
      // Each item takes an equal slice of the bar (flex-1) so the entire
      // 60px-tall pill is tappable — comfortably above Apple's 44pt target.
      className="flex-1 min-w-0 h-full flex items-center justify-center relative group rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-0 active:scale-[0.97] transition-transform duration-150"
    >
      <span
        className={[
          "relative flex flex-col items-center justify-center gap-0.5 rounded-full transition-colors duration-200 ease-out min-w-0 w-full h-[52px]",
          active
            ? "bg-lime text-ink px-3 ring-1 ring-ink/15 shadow-[0_4px_12px_-4px_color-mix(in_oklab,var(--lime)_55%,transparent)]"
            : "text-paper px-2 group-hover:bg-paper/10 group-hover:text-paper",
        ].join(" ")}
      >
        <span className="relative inline-flex">
          <Icon
            className="h-[22px] w-[22px]"
            strokeWidth={active ? 2.75 : 2.25}
          />
          {hasUnread && !active && (
            <span
              aria-hidden
              className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-lime text-ink text-[10px] font-bold leading-[18px] text-center ring-2 ring-ink tabular-nums"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </span>
        <span
          className={[
            "text-[10px] font-bold tracking-tight leading-none whitespace-nowrap truncate max-w-full",
            active ? "" : "text-paper/90",
          ].join(" ")}
        >
          {label}
        </span>
      </span>
      <span className="sr-only">
        {hasUnread ? `${label}, ${unreadCount} unread` : label}
      </span>
    </Link>
  );
}

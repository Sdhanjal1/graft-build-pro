import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { getUnreadNotificationCount } from "@/lib/notifications.functions";

export function NotificationsBell() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const fetchCount = useServerFn(getUnreadNotificationCount);

  const { data } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => fetchCount(),
    enabled: !!session,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    retry: false,
    select: (r: { unreadCount: number }) => r?.unreadCount ?? 0,
  });

  // Realtime: bump count on any notification change for this user
  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel(`notif-bell:${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${session.user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, queryClient]);

  const count = data ?? 0;
  const hasUnread = count > 0;

  return (
    <Link
      to="/notifications"
      aria-label={hasUnread ? `Notifications, ${count} unread` : "Notifications"}
      className="relative h-10 w-10 shrink-0 grid place-items-center rounded-full bg-paper/10 ring-1 ring-paper/15 text-paper/80 hover:text-lime hover:bg-paper/15 active:text-lime transition"
    >
      <Bell className="h-5 w-5" />
      {hasUnread && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-lime text-ink text-[10px] font-bold leading-[18px] text-center ring-2 ring-surface">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

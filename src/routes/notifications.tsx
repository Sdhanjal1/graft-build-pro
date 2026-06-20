import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from "@/lib/notifications.functions";
import {
  Bell,
  MessageSquare,
  FileText,
  CheckCircle2,
  XCircle,
  CreditCard,
  CalendarClock,
  Inbox,
} from "lucide-react";

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
  head: () => ({
    meta: [
      { title: "Notifications · Quottr" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function formatRelativeShort(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function iconFor(kind: string) {
  if (kind.includes("payment") || kind.includes("paid")) return CreditCard;
  if (kind.includes("accepted")) return CheckCircle2;
  if (kind.includes("declined")) return XCircle;
  if (kind.includes("request")) return FileText;
  if (kind.includes("message") || kind.startsWith("msg") || kind.startsWith("portal-msg")) return MessageSquare;
  if (kind.includes("reminder") || kind.startsWith("svc")) return CalendarClock;
  return Bell;
}

function NotificationsPage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const list = useServerFn(listMyNotifications);
  const markRead = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const queryKey = ["notifications", "list"] as const;
  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => list({ data: { limit: 50 } }),
    enabled: !!session,
    staleTime: 10_000,
  });

  // Realtime: refresh on inserts/updates
  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel(`notifications:${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${session.user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, queryClient]);

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const markReadMut = useMutation({
    mutationFn: (id: string) => markRead({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  const markAllMut = useMutation({
    mutationFn: () => markAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  const handleOpen = (n: NotificationRow) => {
    if (!n.read_at) markReadMut.mutate(n.id);
    if (n.url) navigate({ to: n.url });
  };

  return (
    <AppShell onRefresh={async () => { await refetch(); }}>
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        back="/app"
        action={
          unreadCount > 0
            ? { label: "Mark all read", onClick: () => markAllMut.mutate() }
            : undefined
        }
      />

      <div className="px-5 pt-3 pb-8 space-y-2">
        {isLoading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card-surface p-3 animate-pulse">
                <div className="h-3 w-1/2 rounded bg-secondary mb-2" />
                <div className="h-3 w-4/5 rounded bg-secondary/70" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <EmptyState
            icon={Inbox}
            title="No notifications yet"
            description="When you get a new quote request, message, or payment, it'll show up here — even if you missed the push."
          />
        )}

        {!isLoading &&
          items.map((n) => {
            const Icon = iconFor(n.kind);
            const unread = !n.read_at;
            const content = (
              <div
                className={[
                  "card-surface p-3 flex items-start gap-3 text-left w-full",
                  unread ? "ring-1 ring-lime/50" : "opacity-90",
                ].join(" ")}
              >
                <div
                  className={[
                    "h-10 w-10 rounded-full shrink-0 grid place-items-center",
                    unread ? "bg-lime/20 text-ink" : "bg-secondary text-ink/70",
                  ].join(" ")}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink truncate">{n.title}</p>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatRelativeShort(n.created_at)}
                    </span>
                  </div>
                  {n.body && (
                    <p className="mt-0.5 text-[13px] text-ink/75 line-clamp-2">{n.body}</p>
                  )}
                  {unread && (
                    <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-lime" aria-label="Unread" />
                  )}
                </div>
              </div>
            );
            return n.url ? (
              <button
                key={n.id}
                type="button"
                onClick={() => handleOpen(n)}
                className="block w-full active:scale-[0.99] transition"
              >
                {content}
              </button>
            ) : (
              <div key={n.id} className="block w-full">
                {content}
              </div>
            );
          })}
      </div>
    </AppShell>
  );
}

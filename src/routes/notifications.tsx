import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

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

const STATUSES = ["all", "unread", "read"] as const;
const CATEGORIES = ["all", "message", "request", "payment", "decision", "reminder", "other"] as const;
type Status = (typeof STATUSES)[number];
type Category = (typeof CATEGORIES)[number];

const searchSchema = z.object({
  status: fallback(z.enum(STATUSES), "all").default("all"),
  category: fallback(z.enum(CATEGORIES), "all").default("all"),
});

export const Route = createFileRoute("/notifications")({
  validateSearch: zodValidator(searchSchema),
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

function categoryFor(kind: string): Category {
  const k = kind.toLowerCase();
  if (k.includes("paid") || k.includes("payment")) return "payment";
  if (k.includes("accepted") || k.includes("declined")) return "decision";
  if (k.startsWith("req") || k.includes("request")) return "request";
  if (k.startsWith("msg") || k.startsWith("portal-msg") || k.includes("message")) return "message";
  if (k.startsWith("svc") || k.includes("reminder")) return "reminder";
  return "other";
}

function iconFor(category: Category) {
  switch (category) {
    case "payment": return CreditCard;
    case "decision": return CheckCircle2;
    case "request": return FileText;
    case "message": return MessageSquare;
    case "reminder": return CalendarClock;
    default: return Bell;
  }
}

const CATEGORY_LABEL: Record<Category, string> = {
  all: "All",
  message: "Messages",
  request: "Requests",
  payment: "Payments",
  decision: "Decisions",
  reminder: "Reminders",
  other: "Other",
};

function NotificationsPage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { status, category } = Route.useSearch();

  const list = useServerFn(listMyNotifications);
  const markRead = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const queryKey = ["notifications", "list"] as const;
  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => list({ data: { limit: 100 } }),
    enabled: !!session,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel(`notifications:${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${session.user.id}` },
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

  const allItems = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  // Available categories from current items (always include 'all')
  const availableCategories = useMemo(() => {
    const set = new Set<Category>();
    set.add("all");
    for (const n of allItems) set.add(categoryFor(n.kind));
    // Stable order from CATEGORIES list
    return CATEGORIES.filter((c) => set.has(c));
  }, [allItems]);

  const items = useMemo(() => {
    return allItems.filter((n) => {
      if (status === "unread" && n.read_at) return false;
      if (status === "read" && !n.read_at) return false;
      if (category !== "all" && categoryFor(n.kind) !== category) return false;
      return true;
    });
  }, [allItems, status, category]);

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
    if (n.url) {
      // n.url is a runtime string from DB (e.g. "/quotes/<id>"); cast for typed router.
      navigate({ to: n.url as never });
    }
  };

  const setStatus = (next: Status) =>
    navigate({ from: "/notifications", search: (prev) => ({ ...prev, status: next }) });
  const setCategory = (next: Category) =>
    navigate({ from: "/notifications", search: (prev) => ({ ...prev, category: next }) });

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

      {/* Filters */}
      <div className="px-5 pt-3 space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 no-scrollbar">
          {STATUSES.map((s) => (
            <FilterChip
              key={s}
              active={status === s}
              onClick={() => setStatus(s)}
              label={s === "all" ? "All" : s === "unread" ? "Unread" : "Read"}
              count={s === "unread" ? unreadCount : undefined}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 no-scrollbar">
          {availableCategories.map((c) => (
            <FilterChip
              key={c}
              active={category === c}
              onClick={() => setCategory(c)}
              label={CATEGORY_LABEL[c]}
            />
          ))}
        </div>
      </div>

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

        {!isLoading && allItems.length === 0 && (
          <EmptyState
            icon={Inbox}
            title="No notifications yet"
            body="When you get a new quote request, message, or payment, it'll show up here — even if you missed the push."
          />
        )}

        {!isLoading && allItems.length > 0 && items.length === 0 && (
          <EmptyState
            icon={Inbox}
            title="Nothing matches these filters"
            body="Try a different status or category."
          />
        )}

        {!isLoading &&
          items.map((n) => {
            const cat = categoryFor(n.kind);
            const Icon = iconFor(cat);
            const unread = !n.read_at;
            const isDeclined = n.kind.toLowerCase().includes("declined");
            const RowIcon = isDeclined ? XCircle : Icon;
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
                  <RowIcon className="h-5 w-5" />
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
              <button
                key={n.id}
                type="button"
                onClick={() => handleOpen(n)}
                className="block w-full active:scale-[0.99] transition"
              >
                {content}
              </button>
            );
          })}
      </div>
    </AppShell>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "shrink-0 h-8 px-3 rounded-full text-[12px] font-bold uppercase tracking-tight inline-flex items-center gap-1.5 transition",
        active
          ? "bg-ink text-paper"
          : "bg-secondary text-ink/70 hover:text-ink",
      ].join(" ")}
    >
      <span>{label}</span>
      {typeof count === "number" && count > 0 && (
        <span
          className={[
            "min-w-[18px] h-[18px] px-1 rounded-full text-[10px] leading-[18px] text-center",
            active ? "bg-lime text-ink" : "bg-ink/10 text-ink",
          ].join(" ")}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

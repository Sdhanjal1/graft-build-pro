import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { getInbox, markThreadRead } from "@/lib/messages.functions";
import { getMyIncomingRequests, markRequestRead, deleteQuoteRequest } from "@/lib/quote-requests.functions";
import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  type NotificationRow,
} from "@/lib/notifications.functions";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";
import {
  MessageSquare,
  Inbox,
  FileText,
  Sparkles,
  Bell,
  CreditCard,
  CheckCircle2,
  XCircle,
  CalendarClock,
  MoreHorizontal,
  CheckCheck,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { VoiceWaveform } from "@/components/icons/VoiceIcons";
import { EmptyState } from "@/components/EmptyState";


type QuoteMessage = Database["public"]["Tables"]["quote_messages"]["Row"];
type QuoteRequest = Database["public"]["Tables"]["quote_requests"]["Row"];

const FILTERS = ["all", "unread", "requests", "notifications", "messages"] as const;
type Filter = (typeof FILTERS)[number];

const searchSchema = z.object({
  filter: fallback(z.enum(FILTERS), "all").default("all"),
});

export const Route = createFileRoute("/messages")({
  validateSearch: zodValidator(searchSchema),
  component: MessagesInbox,
});

function formatRelativeShort(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function refShort(quoteId: string): string {
  return `#${quoteId.slice(0, 4).toUpperCase()}`;
}

function iconForNotification(kind: string) {
  const k = kind.toLowerCase();
  if (k.includes("paid") || k.includes("payment")) return CreditCard;
  if (k.includes("accepted")) return CheckCircle2;
  if (k.includes("declined")) return XCircle;
  if (k.includes("reminder") || k.startsWith("svc")) return CalendarClock;
  if (k.includes("request")) return FileText;
  if (k.includes("message")) return MessageSquare;
  return Bell;
}

function SkeletonCard() {
  return (
    <div className="card-surface p-3 flex items-start gap-3 animate-pulse">
      <div className="h-10 w-10 rounded-full bg-secondary shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 w-1/2 rounded bg-secondary" />
        <div className="h-3 w-4/5 rounded bg-secondary/70" />
      </div>
    </div>
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
        active ? "bg-ink text-paper" : "bg-secondary text-ink/70 hover:text-ink",
      ].join(" ")}
    >
      <span>{label}</span>
      {typeof count === "number" && count > 0 && (
        <span
          className={[
            "min-w-[18px] h-[18px] px-1 rounded-full text-[10px] leading-[18px] text-center font-bold",
            active ? "bg-lime text-ink" : "bg-lime text-ink",
          ].join(" ")}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

function MessagesInbox() {
  const fetchInbox = useServerFn(getInbox);
  const fetchRequests = useServerFn(getMyIncomingRequests);
  const fetchNotifs = useServerFn(listMyNotifications);
  const markReqRead = useServerFn(markRequestRead);
  const markNotifRead = useServerFn(markNotificationRead);
  const markAllNotifsRead = useServerFn(markAllNotificationsRead);
  const markThread = useServerFn(markThreadRead);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { session } = useSession();
  const { filter } = Route.useSearch();

  const [messages, setMessages] = useState<QuoteMessage[]>([]);
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const knownReqIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const cancelledRef = useRef(false);

  const notifsQuery = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => fetchNotifs({ data: { limit: 100 } }),
    enabled: !!session,
    staleTime: 10_000,
  });
  const notifications: NotificationRow[] = notifsQuery.data?.items ?? [];

  const load = async () => {
    try {
      const [inbox, reqs] = await Promise.all([fetchInbox(), fetchRequests()]);
      if (cancelledRef.current) return;
      setMessages(inbox.messages as QuoteMessage[]);
      setRequests(reqs.requests as QuoteRequest[]);
      if (!initialized.current) {
        reqs.requests.forEach((r: { id: string }) => knownReqIds.current.add(r.id));
        initialized.current = true;
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    cancelledRef.current = false;
    void load();
    let cleanup: (() => void) | undefined;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelledRef.current) return;
      const ch = supabase
        .channel(`inbox-${user.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "quote_messages", filter: `user_id=eq.${user.id}` }, () => void load())
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "quote_requests", filter: `pro_user_id=eq.${user.id}` }, (payload: { new: QuoteRequest }) => {
          const row = payload.new;
          if (!knownReqIds.current.has(row.id)) {
            knownReqIds.current.add(row.id);
            notifyNewRequest(row);
          }
          void load();
          void queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
        })
        .subscribe();
      cleanup = () => { void supabase.removeChannel(ch); };
    })();
    return () => {
      cancelledRef.current = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const threads = useMemo(() => {
    const byQuote = new Map<string, { quote_id: string; last: QuoteMessage; unread: number }>();
    for (const m of messages) {
      const cur = byQuote.get(m.quote_id);
      if (!cur || new Date(m.created_at) > new Date(cur.last.created_at)) {
        const unread = cur?.unread ?? 0;
        byQuote.set(m.quote_id, { quote_id: m.quote_id, last: m, unread });
      }
      if (m.sender === "customer" && !m.read_at) {
        const c = byQuote.get(m.quote_id)!;
        c.unread = (c.unread || 0) + 1;
      }
    }
    return [...byQuote.values()].sort(
      (a, b) => new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime()
    );
  }, [messages]);

  const newRequests = requests.filter((r) => !r.read_at);
  const unreadThreadTotal = threads.reduce((n, t) => n + (t.unread || 0), 0);
  const unreadNotifs = notifications.filter((n) => !n.read_at).length;
  const totalUnread = newRequests.length + unreadThreadTotal + unreadNotifs;
  const hasRealThread = threads.some((t) => t.last.sender !== "system");
  const isEmpty = !hasRealThread && requests.length === 0 && notifications.length === 0;

  const showRequests = filter === "all" || filter === "requests" || filter === "unread";
  const showThreads = filter === "all" || filter === "messages" || filter === "unread";
  const showNotifs = filter === "all" || filter === "notifications" || filter === "unread";

  const filteredRequests = showRequests
    ? filter === "unread"
      ? requests.filter((r) => !r.read_at)
      : requests
    : [];
  const filteredThreads = showThreads
    ? filter === "unread"
      ? threads.filter((t) => t.unread > 0)
      : threads
    : [];
  const filteredNotifs = showNotifs
    ? filter === "unread"
      ? notifications.filter((n) => !n.read_at)
      : notifications
    : [];

  const showEmpty =
    !loading &&
    filteredRequests.length === 0 &&
    filteredThreads.length === 0 &&
    filteredNotifs.length === 0;

  const subtitle = useMemo(() => {
    if (loading) return "Loading…";
    if (isEmpty) return "All caught up";
    return totalUnread > 0 ? `${totalUnread} unread` : "All caught up";
  }, [loading, isEmpty, totalUnread]);

  const setFilter = (next: Filter) =>
    navigate({ from: "/messages", search: () => ({ filter: next }) });

  const handleRequestRead = async (id: string) => {
    await markReqRead({ data: { id } }).catch(() => {});
    void queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
    void load();
  };

  const handleOpenThread = async (quoteId: string, unread: number) => {
    if (unread > 0) {
      await markThread({ data: { quoteId } }).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
      void load();
    }
    navigate({ to: "/quotes/$quoteId", params: { quoteId }, search: { tab: "messages" } });
  };

  const handleOpenNotification = async (n: NotificationRow) => {
    if (!n.read_at) {
      await markNotifRead({ data: { id: n.id } }).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    }
    if (n.url) navigate({ to: n.url as never });
  };

  const deleteNotif = useServerFn(deleteNotification);
  const deleteReq = useServerFn(deleteQuoteRequest);

  // Items currently visible in the selected filter
  const visibleRequests = filteredRequests;
  const visibleThreads = filteredThreads;
  const visibleNotifs = filteredNotifs;

  const visibleUnreadCount =
    visibleRequests.filter((r) => !r.read_at).length +
    visibleThreads.reduce((n, t) => n + (t.unread || 0), 0) +
    visibleNotifs.filter((n) => !n.read_at).length;

  // Threads can't be deleted (would destroy message history); deletion targets requests + notifications.
  const visibleDeletableCount = visibleRequests.length + visibleNotifs.length;

  const handleMarkAllRead = async () => {
    const ops: Promise<unknown>[] = [];
    for (const n of visibleNotifs) if (!n.read_at) ops.push(markNotifRead({ data: { id: n.id } }).catch(() => {}));
    for (const r of visibleRequests) if (!r.read_at) ops.push(markReqRead({ data: { id: r.id } }).catch(() => {}));
    for (const t of visibleThreads) if (t.unread > 0) ops.push(markThread({ data: { quoteId: t.quote_id } }).catch(() => {}));
    await Promise.all(ops);
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    void queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
    void load();
    toast.success(visibleUnreadCount > 0 ? `${visibleUnreadCount} marked as read` : "All caught up");
  };

  // Shortcut when the user is viewing everything: hit the dedicated "mark all" endpoint.
  const handleMarkEverythingRead = async () => {
    const ops: Promise<unknown>[] = [markAllNotifsRead().catch(() => {})];
    for (const r of requests) if (!r.read_at) ops.push(markReqRead({ data: { id: r.id } }).catch(() => {}));
    for (const t of threads) if (t.unread > 0) ops.push(markThread({ data: { quoteId: t.quote_id } }).catch(() => {}));
    await Promise.all(ops);
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    void queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
    void load();
    toast.success("All caught up");
  };

  const handleDeleteAll = async () => {
    if (visibleDeletableCount === 0) {
      toast.info("Nothing to delete in this view");
      return;
    }
    const threadNote = visibleThreads.length > 0 ? " Message threads will be kept." : "";
    if (typeof window !== "undefined" && !window.confirm(`Delete ${visibleDeletableCount} item${visibleDeletableCount === 1 ? "" : "s"}?${threadNote}`)) {
      return;
    }
    const ops: Promise<unknown>[] = [];
    for (const n of visibleNotifs) ops.push(deleteNotif({ data: { id: n.id } }).catch(() => {}));
    for (const r of visibleRequests) ops.push(deleteReq({ data: { id: r.id } }).catch(() => {}));
    await Promise.all(ops);
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    void queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
    void load();
    toast.success(`${visibleDeletableCount} deleted`);
  };

  const filterLabel: Record<Filter, string> = {
    all: "everything",
    unread: "unread items",
    requests: "requests",
    notifications: "notifications",
    messages: "messages",
  };

  return (
    <AppShell>
      <PageHeader
        title="Inbox"
        subtitle={subtitle}
        right={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Bulk actions"
                className="shrink-0 h-9 w-9 rounded-full bg-secondary text-ink inline-flex items-center justify-center active:scale-[0.97] transition"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onSelect={() => void (filter === "all" ? handleMarkEverythingRead() : handleMarkAllRead())}
                disabled={visibleUnreadCount === 0}
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                <span className="flex-1">Mark {filterLabel[filter as Filter]} as read</span>
                {visibleUnreadCount > 0 && (
                  <span className="ml-2 text-[10px] font-bold text-muted-foreground">{visibleUnreadCount}</span>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => void handleDeleteAll()}
                disabled={visibleDeletableCount === 0}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                <span className="flex-1">Delete {filterLabel[filter as Filter]}</span>
                {visibleDeletableCount > 0 && (
                  <span className="ml-2 text-[10px] font-bold text-muted-foreground">{visibleDeletableCount}</span>
                )}
              </DropdownMenuItem>
              {visibleThreads.length > 0 && (
                <p className="px-2 pt-1 pb-1.5 text-[10px] text-muted-foreground">
                  Message threads are kept so you don't lose history.
                </p>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />


      {/* Filters */}
      <div className="px-5 pt-3">
        <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 no-scrollbar">
          <FilterChip label="All" active={filter === "all"} onClick={() => setFilter("all")} />
          <FilterChip label="Unread" active={filter === "unread"} onClick={() => setFilter("unread")} count={totalUnread} />
          <FilterChip label="Requests" active={filter === "requests"} onClick={() => setFilter("requests")} count={newRequests.length} />
          <FilterChip label="Notifications" active={filter === "notifications"} onClick={() => setFilter("notifications")} count={unreadNotifs} />
          <FilterChip label="Messages" active={filter === "messages"} onClick={() => setFilter("messages")} count={unreadThreadTotal} />
        </div>
      </div>

      {loading && (
        <div className="px-5 mt-3 space-y-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && filteredRequests.length > 0 && (
        <section className="px-5 mt-3">
          <div className="flex items-baseline justify-between mb-2.5">
            <h2 className="text-xl">
              Quote requests
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">({filteredRequests.length})</span>
            </h2>
          </div>
          <ul className="space-y-2">
            {filteredRequests.map((r) => {
              const unread = !r.read_at;
              return (
                <li key={r.id}>
                  <div
                    className={`relative card-surface p-3 flex items-start gap-3 ${unread ? "before:absolute before:left-0 before:top-3 before:bottom-3 before:w-0.5 before:bg-lime before:rounded-full" : ""}`}
                  >
                    <div className="h-10 w-10 rounded-full bg-lime/40 flex items-center justify-center shrink-0">
                      {r.source === "voice" ? <VoiceWaveform size={16} className="text-ink" /> : <FileText className="h-4 w-4 text-ink" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground inline-flex items-center gap-1.5">
                          {unread && <span className="h-1.5 w-1.5 rounded-full bg-lime" />}
                          New request
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatRelativeShort(r.created_at)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-ink truncate mt-0.5">
                        {r.customer_name || "New lead"}
                        {r.customer_phone && (
                          <span className="font-normal text-muted-foreground"> · {r.customer_phone}</span>
                        )}
                      </p>
                      <p className="text-[13px] text-muted-foreground mt-1 line-clamp-2">{r.body}</p>
                      <div className="mt-2.5 flex gap-2">
                        <Link
                          to="/quotes/new"
                          search={{ prefill: r.body }}
                          onClick={() => { if (unread) void handleRequestRead(r.id); }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold bg-lime text-ink rounded-full px-3 py-1.5"
                        >
                          <Sparkles className="h-3 w-3" />
                          Create quote
                        </Link>
                        {unread && (
                          <button
                            type="button"
                            onClick={() => void handleRequestRead(r.id)}
                            className="inline-flex items-center text-[11px] font-semibold text-muted-foreground rounded-full px-3 py-1.5 hover:bg-secondary"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!loading && filteredNotifs.length > 0 && (
        <section className="px-5 mt-4">
          <div className="flex items-baseline justify-between mb-2.5">
            <h2 className="text-xl">
              Notifications
              {unreadNotifs > 0 && (
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">({unreadNotifs} unread)</span>
              )}
            </h2>
          </div>
          <ul className="space-y-2">
            {filteredNotifs.map((n) => {
              const Icon = iconForNotification(n.kind);
              const unread = !n.read_at;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void handleOpenNotification(n)}
                    className={`w-full text-left relative card-surface p-3 flex items-start gap-3 active:scale-[0.99] transition ${unread ? "before:absolute before:left-0 before:top-3 before:bottom-3 before:w-0.5 before:bg-lime before:rounded-full" : ""}`}
                  >
                    <div className={`h-10 w-10 rounded-full shrink-0 grid place-items-center ${unread ? "bg-lime/30 text-ink" : "bg-secondary text-ink/70"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-ink truncate inline-flex items-center gap-1.5">
                          {unread && <span className="h-1.5 w-1.5 rounded-full bg-lime shrink-0" />}
                          {n.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatRelativeShort(n.created_at)}
                        </span>
                      </div>
                      {n.body && (
                        <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!loading && filteredThreads.length > 0 && (
        <section className="px-5 mt-4">
          <div className="flex items-baseline justify-between mb-2.5">
            <h2 className="text-xl">Messages</h2>
            {unreadThreadTotal > 0 && (
              <span className="text-xs text-muted-foreground">{unreadThreadTotal} unread</span>
            )}
          </div>

          <ul className="space-y-2 pb-2">
            {filteredThreads.map((t) => {
              const unread = t.unread > 0;
              const isSystem = t.last.sender === "system";
              return (
                <li key={t.quote_id}>
                  <button
                    type="button"
                    onClick={() => void handleOpenThread(t.quote_id, t.unread)}
                    className={`w-full text-left relative card-surface p-3 flex items-start gap-3 active:scale-[0.99] transition ${unread ? "before:absolute before:left-0 before:top-3 before:bottom-3 before:w-0.5 before:bg-lime before:rounded-full" : ""}`}
                  >
                    <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <MessageSquare className="h-4 w-4 text-ink" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-ink truncate inline-flex items-center gap-1.5">
                          {unread && <span className="h-1.5 w-1.5 rounded-full bg-lime shrink-0" />}
                          <span className="text-muted-foreground font-normal">{refShort(t.quote_id)}</span>
                          <span>·</span>
                          <span className="truncate">
                            {t.last.sender === "customer" ? "Customer" : isSystem ? "Auto-reply" : "You"}
                          </span>
                          {t.unread > 1 && (
                            <span className="text-[10px] font-bold text-muted-foreground">+{t.unread}</span>
                          )}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatRelativeShort(t.last.created_at)}
                        </span>
                      </div>
                      <p className="text-[13px] text-muted-foreground truncate mt-0.5">
                        {isSystem && (
                          <span className="inline-block text-[9px] font-bold uppercase tracking-wide bg-secondary text-ink rounded px-1 py-0.5 mr-1.5 align-middle">Auto</span>
                        )}
                        {t.last.body}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {showEmpty && (
        <section className="px-5 mt-4">
          <EmptyState
            icon={Inbox}
            title={filter === "unread" ? "Nothing unread." : "All quiet."}
            body={filter === "unread" ? "You're all caught up." : "Replies, requests and updates show up here."}
          />
        </section>
      )}
    </AppShell>
  );
}

function notifyNewRequest(row: QuoteRequest) {
  try {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const title = row.customer_name ? `${row.customer_name} wants a quote` : "New job request";
    const body = (row.body || "").slice(0, 140);
    new Notification(title, { body, icon: "/app-icon.png", tag: `req-${row.id}` });
  } catch { /* ignore */ }
}

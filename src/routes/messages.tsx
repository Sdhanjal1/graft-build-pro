import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { getInbox, markThreadRead, markThreadUnread } from "@/lib/messages.functions";
import { getMyIncomingRequests, markRequestRead, markRequestUnread, deleteQuoteRequest } from "@/lib/quote-requests.functions";
import {
  listMyNotifications,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  deleteNotification,
  type NotificationRow,
} from "@/lib/notifications.functions";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLongPress } from "@/hooks/useLongPress";
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
  CheckCheck,
  Trash2,
  X,
  ArrowRight,
  Check,
  MailOpen,
  Mail,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { VoiceWaveform } from "@/components/icons/VoiceIcons";
import { EmptyState } from "@/components/EmptyState";
import { SwipeRow } from "@/components/SwipeRow";


type QuoteMessage = Database["public"]["Tables"]["quote_messages"]["Row"];
type QuoteRequest = Database["public"]["Tables"]["quote_requests"]["Row"];

const FILTERS = ["all", "unread", "requests"] as const;
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

function formatFullDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayGroup(iso: string): "Today" | "Yesterday" | "This week" | "Earlier" {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This week";
  return "Earlier";
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
    <div className="card-surface p-4 flex items-start gap-3 animate-pulse">
      <div className="h-11 w-11 rounded-full bg-secondary shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 w-1/2 rounded bg-secondary" />
        <div className="h-3 w-4/5 rounded bg-secondary/70" />
      </div>
    </div>
  );
}

function FilterTab({
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
        "shrink-0 h-9 px-4 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5 transition",
        active ? "bg-ink text-paper" : "text-ink/60 hover:text-ink",
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

/* ---------- Unified feed item shape ---------- */
type FeedItem = {
  id: string; // prefixed: req-…, thread-…, notif-…
  rawId: string;
  kind: "request" | "thread" | "notification";
  ts: string; // ISO
  unread: boolean;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  title: string;
  body: string;
  /** Long-form body shown in the preview sheet (defaults to body). */
  detailBody?: string;
  /** Secondary line shown in the preview sheet (e.g. phone). */
  meta?: string;
  /** Primary action shown in the preview sheet. */
  primary?: { label: string; run: () => void; icon?: React.ComponentType<{ className?: string }> };
  /** Mark-as-read fn used when opening the preview. */
  markRead?: () => void;
  /** Raw server calls (used by optimistic + undo wrappers). */
  serverMarkRead: () => Promise<unknown>;
  serverMarkUnread: () => Promise<unknown>;
  /** Whether this item can be deleted (threads can't — would lose history). */
  canDelete: boolean;
  /** Raw server delete (used by deferred delete + undo). No-op if canDelete is false. */
  serverDelete?: () => Promise<unknown>;
  /** Invalidation keys to refresh after a server-side change. */
  invalidateKeys: string[][];
};

function FeedRow({
  item,
  selected,
  selectionMode,
  onPreview,
  onToggleSelect,
  onLongPress,
  onToggleRead,
  onDelete,
}: {
  item: FeedItem;
  selected: boolean;
  selectionMode: boolean;
  onPreview: () => void;
  onToggleSelect: () => void;
  onLongPress: () => void;
  onToggleRead: (item: FeedItem) => void;
  onDelete: (item: FeedItem) => void;
}) {
  const Icon = item.icon;
  const lp = useLongPress(onLongPress, 450);

  const handleClick = () => {
    if (lp.didLongPress()) {
      lp.resetLongPress();
      return;
    }
    if (selectionMode) onToggleSelect();
    else onPreview();
  };

  const rowInner = (
    <button
      type="button"
      onClick={handleClick}
      {...lp.handlers}
      className={[
        "w-full text-left relative card-surface p-4 flex items-start gap-3 transition select-none",
        "active:scale-[0.99]",
        item.unread ? "bg-lime/[0.06]" : "",
        selected ? "ring-2 ring-lime" : "",
        item.unread ? "before:absolute before:left-0 before:top-4 before:bottom-4 before:w-1 before:bg-lime before:rounded-full" : "",
      ].join(" ")}
    >
      {selectionMode ? (
        <div
          className={`h-11 w-11 shrink-0 rounded-full grid place-items-center border-2 transition ${
            selected ? "bg-lime border-lime text-ink" : "bg-paper border-border text-transparent"
          }`}
        >
          <Check className="h-5 w-5" strokeWidth={3} />
        </div>
      ) : (
        <div className={`h-11 w-11 rounded-full shrink-0 grid place-items-center ${item.unread ? "bg-lime/30 text-ink" : "bg-secondary text-ink/70"}`}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`truncate ${item.unread ? "text-[15px] font-bold text-ink" : "text-sm font-medium text-ink/75"}`}>
            {item.title}
          </p>
          <span className={`text-[11px] shrink-0 ${item.unread ? "text-ink font-semibold" : "text-muted-foreground"}`}>
            {formatRelativeShort(item.ts)}
          </span>
        </div>
        {item.body && (
          <p className={`text-[13px] mt-1 line-clamp-2 ${item.unread ? "text-ink/75" : "text-muted-foreground"}`}>
            {item.body}
          </p>
        )}
      </div>
    </button>
  );

  // In selection mode we disable swipe so taps don't conflict with selection.
  if (selectionMode) return rowInner;

  return (
    <SwipeRow
      actionsLabel={`Actions for ${item.title}`}
      onChase={() => onToggleRead(item)}
      chaseLabel={item.unread ? "Mark read" : "Mark unread"}
      chaseIcon={item.unread ? MailOpen : Mail}
      chaseClassName="bg-lime text-ink"
      onDelete={item.canDelete && item.serverDelete ? () => onDelete(item) : undefined}
      confirmLabel="Delete"
    >
      {rowInner}
    </SwipeRow>
  );
}

function MessagesInbox() {
  const fetchInbox = useServerFn(getInbox);
  const fetchRequests = useServerFn(getMyIncomingRequests);
  const fetchNotifs = useServerFn(listMyNotifications);
  const markReqRead = useServerFn(markRequestRead);
  const markReqUnread = useServerFn(markRequestUnread);
  const markNotifRead = useServerFn(markNotificationRead);
  const markNotifUnread = useServerFn(markNotificationUnread);
  const markAllNotifsRead = useServerFn(markAllNotificationsRead);
  const markThread = useServerFn(markThreadRead);
  const markThreadUn = useServerFn(markThreadUnread);
  const deleteNotif = useServerFn(deleteNotification);
  const deleteReq = useServerFn(deleteQuoteRequest);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { session } = useSession();
  const { filter } = Route.useSearch();

  const [messages, setMessages] = useState<QuoteMessage[]>([]);
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewItem, setPreviewItem] = useState<FeedItem | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Optimistic unread override: item.id → unread? */
  const [optimisticUnread, setOptimisticUnread] = useState<Map<string, boolean>>(new Map());
  /** Items pending deferred deletion (hidden from feed until timer fires or undo). */
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const deleteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
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

  const setFilter = (next: Filter) =>
    navigate({ from: "/messages", search: () => ({ filter: next }) });

  const handleRequestRead = useCallback(async (id: string) => {
    await markReqRead({ data: { id } }).catch(() => {});
    void queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  const handleThreadRead = useCallback(async (quoteId: string) => {
    await markThread({ data: { quoteId } }).catch(() => {});
    void queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  const handleNotifRead = useCallback(async (id: string) => {
    await markNotifRead({ data: { id } }).catch(() => {});
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  /* ---------- Build unified feed ---------- */
  const feed: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = [];

    for (const r of requests) {
      const wasUnread = !r.read_at;
      items.push({
        id: `req-${r.id}`,
        rawId: r.id,
        kind: "request",
        ts: r.created_at,
        unread: wasUnread,
        icon: r.source === "voice" ? VoiceWaveform : FileText,
        title: r.customer_name ? `New request · ${r.customer_name}` : "New job request",
        body: r.body || "",
        detailBody: r.body || "",
        meta: r.customer_phone || undefined,
        markRead: wasUnread ? () => void handleRequestRead(r.id) : undefined,
        toggleRead: async () => {
          if (wasUnread) await markReqRead({ data: { id: r.id } }).catch(() => {});
          else await markReqUnread({ data: { id: r.id } }).catch(() => {});
          void queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
          void load();
          toast.success(wasUnread ? "Marked as read" : "Marked as unread");
        },
        canDelete: true,
        doDelete: async () => {
          await deleteReq({ data: { id: r.id } }).catch(() => {});
          void queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
          void load();
          toast.success("Deleted");
        },
        primary: {
          label: "Create quote",
          icon: Sparkles,
          run: () => {
            if (!r.read_at) void handleRequestRead(r.id);
            navigate({ to: "/quotes/new", search: { prefill: r.body } });
          },
        },
      });
    }

    for (const t of threads) {
      if (t.last.sender === "system" && t.unread === 0) continue;
      const who = t.last.sender === "customer" ? "Customer" : t.last.sender === "system" ? "Auto-reply" : "You";
      const threadUnread = t.unread > 0;
      items.push({
        id: `thread-${t.quote_id}`,
        rawId: t.quote_id,
        kind: "thread",
        ts: t.last.created_at,
        unread: threadUnread,
        icon: MessageSquare,
        title: `${who} replied`,
        body: t.last.body,
        detailBody: t.last.body,
        markRead: threadUnread ? () => void handleThreadRead(t.quote_id) : undefined,
        toggleRead: async () => {
          if (threadUnread) await markThread({ data: { quoteId: t.quote_id } }).catch(() => {});
          else await markThreadUn({ data: { quoteId: t.quote_id } }).catch(() => {});
          void queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
          void load();
          toast.success(threadUnread ? "Marked as read" : "Marked as unread");
        },
        canDelete: false,
        primary: {
          label: "Open conversation",
          icon: ArrowRight,
          run: () => {
            if (threadUnread) void handleThreadRead(t.quote_id);
            navigate({ to: "/quotes/$quoteId", params: { quoteId: t.quote_id }, search: { tab: "messages" } });
          },
        },
      });
    }

    for (const n of notifications) {
      const notifUnread = !n.read_at;
      items.push({
        id: `notif-${n.id}`,
        rawId: n.id,
        kind: "notification",
        ts: n.created_at,
        unread: notifUnread,
        icon: iconForNotification(n.kind),
        title: n.title,
        body: n.body || "",
        detailBody: n.body || "",
        markRead: notifUnread ? () => void handleNotifRead(n.id) : undefined,
        toggleRead: async () => {
          if (notifUnread) await markNotifRead({ data: { id: n.id } }).catch(() => {});
          else await markNotifUnread({ data: { id: n.id } }).catch(() => {});
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
          toast.success(notifUnread ? "Marked as read" : "Marked as unread");
        },
        canDelete: true,
        doDelete: async () => {
          await deleteNotif({ data: { id: n.id } }).catch(() => {});
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
          toast.success("Deleted");
        },
        primary: n.url
          ? {
              label: "Open",
              icon: ArrowRight,
              run: () => {
                if (!n.read_at) void handleNotifRead(n.id);
                if (n.url) navigate({ to: n.url as never });
              },
            }
          : undefined,
      });
    }

    items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, threads, notifications]);

  const visibleFeed = useMemo(() => {
    if (filter === "unread") return feed.filter((i) => i.unread);
    if (filter === "requests") return feed.filter((i) => i.kind === "request");
    return feed;
  }, [feed, filter]);

  // Group visible feed by day
  const grouped = useMemo(() => {
    const groups: { label: string; items: FeedItem[] }[] = [];
    const order = ["Today", "Yesterday", "This week", "Earlier"] as const;
    const buckets: Record<string, FeedItem[]> = {};
    for (const it of visibleFeed) {
      const g = dayGroup(it.ts);
      (buckets[g] ||= []).push(it);
    }
    for (const k of order) {
      if (buckets[k]?.length) groups.push({ label: k, items: buckets[k] });
    }
    return groups;
  }, [visibleFeed]);

  const showEmpty = !loading && visibleFeed.length === 0;

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

  /* ---------- Selection mode ---------- */
  const enterSelectionFor = (item: FeedItem) => {
    setSelectionMode(true);
    setSelected(new Set([item.id]));
  };
  const exitSelection = () => {
    setSelectionMode(false);
    setSelected(new Set());
  };
  const toggleSelect = (item: FeedItem) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  };

  const selectedItems = useMemo(() => visibleFeed.filter((i) => selected.has(i.id)), [visibleFeed, selected]);
  const selectedUnreadCount = selectedItems.filter((i) => i.unread).length;
  const selectedDeletableCount = selectedItems.filter((i) => i.kind !== "thread").length;

  const handleMarkSelectedRead = async () => {
    const ops: Promise<unknown>[] = [];
    for (const i of selectedItems) {
      if (!i.unread) continue;
      if (i.kind === "notification") ops.push(markNotifRead({ data: { id: i.rawId } }).catch(() => {}));
      else if (i.kind === "request") ops.push(markReqRead({ data: { id: i.rawId } }).catch(() => {}));
      else if (i.kind === "thread") ops.push(markThread({ data: { quoteId: i.rawId } }).catch(() => {}));
    }
    await Promise.all(ops);
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    void queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
    void load();
    toast.success(`${selectedUnreadCount} marked as read`);
    exitSelection();
  };

  const handleDeleteSelected = async () => {
    if (selectedDeletableCount === 0) {
      toast.info("Message threads can't be deleted");
      return;
    }
    const hasThreads = selectedItems.some((i) => i.kind === "thread");
    const note = hasThreads ? " Message threads will be kept." : "";
    if (typeof window !== "undefined" && !window.confirm(`Delete ${selectedDeletableCount} item${selectedDeletableCount === 1 ? "" : "s"}?${note}`)) {
      return;
    }
    const ops: Promise<unknown>[] = [];
    for (const i of selectedItems) {
      if (i.kind === "notification") ops.push(deleteNotif({ data: { id: i.rawId } }).catch(() => {}));
      else if (i.kind === "request") ops.push(deleteReq({ data: { id: i.rawId } }).catch(() => {}));
    }
    await Promise.all(ops);
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    void queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
    void load();
    toast.success(`${selectedDeletableCount} deleted`);
    exitSelection();
  };

  const openPreview = (item: FeedItem) => {
    if (item.markRead) item.markRead();
    setPreviewItem(item);
  };

  /* ---------- Render ---------- */
  return (
    <AppShell>
      {/* Selection-mode header replaces normal page header */}
      {selectionMode ? (
        <div className="sticky top-0 z-30 bg-ink text-paper px-4 py-3 flex items-center gap-3 shadow-md">
          <button
            type="button"
            aria-label="Cancel selection"
            onClick={exitSelection}
            className="h-9 w-9 rounded-full bg-paper/10 inline-flex items-center justify-center active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="flex-1 text-sm font-semibold">
            {selected.size} selected
          </p>
          <button
            type="button"
            disabled={selectedUnreadCount === 0}
            onClick={() => void handleMarkSelectedRead()}
            className="h-9 px-3 rounded-full bg-paper/10 inline-flex items-center gap-1.5 text-xs font-semibold disabled:opacity-40 active:scale-95"
          >
            <CheckCheck className="h-4 w-4" />
            Mark read
          </button>
          <button
            type="button"
            disabled={selectedDeletableCount === 0}
            onClick={() => void handleDeleteSelected()}
            className="h-9 w-9 rounded-full bg-paper/10 inline-flex items-center justify-center disabled:opacity-40 active:scale-95"
            aria-label="Delete selected"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <PageHeader
          title="Inbox"
          subtitle={loading || isEmpty ? undefined : totalUnread > 0 ? `${totalUnread} unread` : "All caught up"}
        />
      )}

      {/* Filter tabs */}
      {!selectionMode && (
        <div className="px-5 pt-3">
          <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 no-scrollbar">
            <FilterTab label="All" active={filter === "all"} onClick={() => setFilter("all")} />
            <FilterTab label="Unread" active={filter === "unread"} onClick={() => setFilter("unread")} count={totalUnread} />
            <FilterTab label="Requests" active={filter === "requests"} onClick={() => setFilter("requests")} count={newRequests.length} />
          </div>
        </div>
      )}

      {/* Inline "Mark all read" — only when there's something to mark and not in selection */}
      {!loading && !selectionMode && totalUnread > 0 && (
        <div className="px-5 mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void handleMarkEverythingRead()}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink/70 hover:text-ink active:scale-[0.98] transition"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        </div>
      )}

      {/* Helper hint on first paint with items (one-liner, not chrome) */}
      {!loading && !selectionMode && visibleFeed.length > 0 && (
        <p className="px-5 mt-2 text-[11px] text-muted-foreground hidden sm:block">
          Tap to preview · Long-press to select multiple
        </p>
      )}

      {loading && (
        <div className="px-5 mt-4 space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Unified chronological feed */}
      {!loading && grouped.length > 0 && (
        <div className="px-5 mt-4 space-y-6 pb-6">
          {grouped.map((g) => (
            <section key={g.label}>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground mb-3 px-1">
                {g.label}
              </p>
              <ul className="space-y-3">
                {g.items.map((it) => (
                  <li key={it.id}>
                    <FeedRow
                      item={it}
                      selected={selected.has(it.id)}
                      selectionMode={selectionMode}
                      onPreview={() => openPreview(it)}
                      onToggleSelect={() => toggleSelect(it)}
                      onLongPress={() => enterSelectionFor(it)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {showEmpty && (
        <section className="px-5 mt-8">
          <EmptyState
            icon={Inbox}
            title={
              filter === "unread" ? "Nothing unread."
              : filter === "requests" ? "No new requests."
              : "All quiet."
            }
            body={
              filter === "unread" ? "You're all caught up."
              : filter === "requests" ? "Customer requests show up here."
              : "Replies, requests and updates show up here."
            }
          />
        </section>
      )}

      {/* Detail sheet — bottom on mobile, right drawer on desktop */}
      <Sheet open={!!previewItem} onOpenChange={(o) => { if (!o) setPreviewItem(null); }}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={isMobile ? "rounded-t-2xl max-h-[85vh] overflow-y-auto" : "w-[440px] sm:max-w-md overflow-y-auto"}
        >
          {previewItem && (
            <>
              <SheetHeader className="text-left">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-lime/30 grid place-items-center shrink-0">
                    <previewItem.icon className="h-5 w-5 text-ink" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-base font-bold truncate">{previewItem.title}</SheetTitle>
                    <SheetDescription className="text-[11px]">
                      {formatFullDateTime(previewItem.ts)}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-4 space-y-3">
                {previewItem.meta && (
                  <p className="text-[13px] text-ink/80">
                    <span className="text-muted-foreground">Contact: </span>
                    {previewItem.meta}
                  </p>
                )}
                {previewItem.detailBody && (
                  <p className="text-[14px] leading-relaxed text-ink whitespace-pre-wrap">
                    {previewItem.detailBody}
                  </p>
                )}
              </div>

              <SheetFooter className="mt-6 flex-col gap-2 sm:flex-col">
                {previewItem.primary && (
                  <button
                    type="button"
                    onClick={() => {
                      const run = previewItem.primary!.run;
                      setPreviewItem(null);
                      run();
                    }}
                    className="w-full h-11 rounded-full bg-lime text-ink font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.99]"
                  >
                    {previewItem.primary.icon && <previewItem.primary.icon className="h-4 w-4" />}
                    {previewItem.primary.label}
                  </button>
                )}
                {previewItem.kind !== "thread" && (
                  <button
                    type="button"
                    onClick={async () => {
                      const item = previewItem;
                      setPreviewItem(null);
                      if (item.kind === "notification") await deleteNotif({ data: { id: item.rawId } }).catch(() => {});
                      else if (item.kind === "request") await deleteReq({ data: { id: item.rawId } }).catch(() => {});
                      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
                      void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
                      void queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
                      void load();
                      toast.success("Deleted");
                    }}
                    className="w-full h-11 rounded-full bg-secondary text-destructive font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.99]"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Keep a hidden Link to /quotes/new so the router preserves type-safe routes after refactor. */}
      <span className="hidden">
        <Link to="/quotes/new" search={{ prefill: "" }}>noop</Link>
      </span>
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

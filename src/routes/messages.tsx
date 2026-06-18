import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { getInbox } from "@/lib/messages.functions";
import { getMyIncomingRequests, markRequestRead } from "@/lib/quote-requests.functions";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { MessageSquare, Inbox, FileText, Sparkles } from "lucide-react";
import { VoiceWaveform } from "@/components/icons/VoiceIcons";
import { EmptyState } from "@/components/EmptyState";

type QuoteMessage = Database["public"]["Tables"]["quote_messages"]["Row"];
type QuoteRequest = Database["public"]["Tables"]["quote_requests"]["Row"];

export const Route = createFileRoute("/messages")({
  component: MessagesInbox,
});

// Short relative timestamp: "2m", "3h", "yesterday", "Mon", "12 Mar"
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

function MessagesInbox() {
  const fetchInbox = useServerFn(getInbox);
  const fetchRequests = useServerFn(getMyIncomingRequests);
  const markRead = useServerFn(markRequestRead);
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<QuoteMessage[]>([]);
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const knownReqIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const cancelledRef = useRef(false);

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
  const hasRealThread = threads.some((t) => t.last.sender !== "system");
  const showEmpty = !loading && !hasRealThread && requests.length === 0;

  const subtitle = useMemo(() => {
    if (loading) return "Loading…";
    if (showEmpty) return "All caught up";
    const parts: string[] = [];
    if (requests.length) parts.push(`${requests.length} request${requests.length === 1 ? "" : "s"}`);
    if (newRequests.length) parts.push(`${newRequests.length} new`);
    if (threads.length) parts.push(`${threads.length} chat${threads.length === 1 ? "" : "s"}`);
    return parts.length ? parts.join(" · ") : "All caught up";
  }, [loading, showEmpty, requests.length, newRequests.length, threads.length]);

  const handleMarkRead = async (id: string) => {
    await markRead({ data: { id } }).catch(() => {});
    void queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
    void load();
  };

  return (
    <AppShell>
      <PageHeader
        title="Inbox"
        subtitle={subtitle}
        action={{
          label: "Filter",
          onClick: () => toast.info("Filters coming soon"),
        }}
      />

      {loading && (
        <div className="px-5 mt-2 space-y-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && requests.length > 0 && (
        <section className="px-5 mt-2">
          <div className="flex items-baseline justify-between mb-2.5">
            <h2 className="text-xl">
              Quote requests
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">({requests.length})</span>
            </h2>
          </div>
          <ul className="space-y-2">
            {requests.map((r) => {
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
                        {r.customer_name || "Unknown caller"}
                        {r.customer_phone && (
                          <span className="font-normal text-muted-foreground"> · {r.customer_phone}</span>
                        )}
                      </p>
                      <p className="text-[13px] text-muted-foreground mt-1 line-clamp-2">{r.body}</p>
                      <div className="mt-2.5 flex gap-2">
                        <Link
                          to="/quotes/new"
                          search={{ prefill: r.body }}
                          onClick={() => { if (unread) void handleMarkRead(r.id); }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold bg-lime text-ink rounded-full px-3 py-1.5"
                        >
                          <Sparkles className="h-3 w-3" />
                          Create quote
                        </Link>
                        {unread && (
                          <button
                            type="button"
                            onClick={() => void handleMarkRead(r.id)}
                            className="inline-flex items-center text-[11px] font-semibold text-muted-foreground rounded-full px-3 py-1.5 hover:bg-secondary"
                          >
                            Mark as read
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

      {showEmpty && (
        <section className="px-5 mt-4">
          <EmptyState
            icon={Inbox}
            title="No messages yet"
            body="When a customer replies to a quote or accepts one, it shows up here."
          />
        </section>
      )}

      {!loading && !showEmpty && threads.length > 0 && (
        <section className="px-5 mt-4">
          <div className="flex items-baseline justify-between mb-2.5">
            <h2 className="text-xl">Messages</h2>
            {unreadThreadTotal > 0 && (
              <span className="text-xs text-muted-foreground">{unreadThreadTotal} unread</span>
            )}
          </div>

          <ul className="space-y-2 pb-2">
            {threads.map((t) => {
              const unread = t.unread > 0;
              const isSystem = t.last.sender === "system";
              return (
                <li key={t.quote_id}>
                  <Link
                    to="/quotes/$quoteId"
                    params={{ quoteId: t.quote_id }}
                    search={{ tab: "messages" }}
                    className={`relative card-surface p-3 flex items-start gap-3 ${unread ? "before:absolute before:left-0 before:top-3 before:bottom-3 before:w-0.5 before:bg-lime before:rounded-full" : ""}`}
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
                  </Link>
                </li>
              );
            })}
          </ul>
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
    const title = row.customer_name ? `New quote request from ${row.customer_name}` : "New quote request";
    const body = (row.body || "").slice(0, 140);
    new Notification(title, { body, icon: "/app-icon.png", tag: `req-${row.id}` });
  } catch { /* ignore */ }
}

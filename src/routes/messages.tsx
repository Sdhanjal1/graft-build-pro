import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
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
    const ch = supabase
      .channel("inbox-all")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "quote_messages" }, () => void load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "quote_requests" }, (payload: { new: QuoteRequest }) => {
        const row = payload.new;
        if (!knownReqIds.current.has(row.id)) {
          knownReqIds.current.add(row.id);
          notifyNewRequest(row);
        }
        void load();
        void queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
      })
      .subscribe();
    return () => {
      cancelledRef.current = true;
      void supabase.removeChannel(ch);
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

  return (
    <AppShell>
      <PageHeader
        title="Inbox"
        subtitle={
          loading
            ? "Requests and chats"
            : `${requests.length} request${requests.length === 1 ? "" : "s"}${newRequests.length ? ` · ${newRequests.length} new` : ""}`
        }
      />

      {loading && <p className="px-5 text-sm text-muted-foreground">Loading…</p>}

      {!loading && requests.length > 0 && (
        <section className="px-5 mt-2">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-xl">Quote requests</h2>
            {newRequests.length > 0 && (
              <span className="text-[10px] font-bold bg-lime text-ink rounded-full px-2 py-0.5">
                {newRequests.length} new
              </span>
            )}
          </div>
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id}>
                <button
                  onClick={async () => {
                    if (!r.read_at) {
                      await markRead({ data: { id: r.id } }).catch(() => {});
                      void queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
                    }
                    void load();
                  }}
                  className={`w-full text-left card-surface p-4 flex items-start gap-3 ${!r.read_at ? "ring-1 ring-lime" : ""}`}
                >
                  <div className="h-10 w-10 rounded-full bg-lime/40 flex items-center justify-center shrink-0">
                    {r.source === "voice" ? <VoiceWaveform size={16} className="text-ink" /> : <FileText className="h-4 w-4 text-ink" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">
                        New request {r.customer_name ? `from ${r.customer_name}` : ""}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(r.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.body}</p>
                    {r.customer_phone && (
                      <p className="text-[11px] text-muted-foreground mt-1">{r.customer_phone}</p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <Link
                        to="/quotes/new"
                        search={{ prefill: r.body }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold bg-ink text-paper rounded-full px-3 py-1.5"
                      >
                        <Sparkles className="h-3 w-3" />
                        Create quote
                      </Link>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="px-5 mt-5">
        <h2 className="text-xl mb-2.5">Messages</h2>
        {!loading && threads.length === 0 && requests.length === 0 && (
          <EmptyState
            icon={Inbox}
            title="Quiet out there"
            body="Share your QR code and let customers come to you while you're on the tools."
            cta={{ label: "Get your QR code", to: "/settings" }}
          />
        )}

        <ul className="space-y-2 pb-24">
          {threads.map((t) => (
            <li key={t.quote_id}>
              <Link
                to="/quotes/$quoteId"
                params={{ quoteId: t.quote_id }}
                search={{ tab: "messages" } as any}
                className="card-surface p-4 flex items-start gap-3"
              >
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <MessageSquare className="h-4 w-4 text-ink" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">
                      {t.last.sender === "customer" ? "Customer" : t.last.sender === "system" ? "Auto-reply" : "You"}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(t.last.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{t.last.body}</p>
                </div>
                {t.unread > 0 && (
                  <span className="ml-2 text-[10px] font-bold bg-lime text-ink rounded-full px-2 py-0.5">
                    {t.unread}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>
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

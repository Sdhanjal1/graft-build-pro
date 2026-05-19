import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { getInbox } from "@/lib/messages.functions";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Inbox } from "lucide-react";

export const Route = createFileRoute("/messages")({
  component: MessagesInbox,
});

function MessagesInbox() {
  const fetchInbox = useServerFn(getInbox);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const r = await fetchInbox();
      setMessages(r.messages);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "quote_messages" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  // Group by quote, latest message per quote
  const threads = useMemo(() => {
    const byQuote = new Map<string, { quote_id: string; last: any; unread: number }>();
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

  return (
    <AppShell>
      <PageHeader title="Messages" subtitle="Customer chats" />

      {loading && <p className="px-5 text-sm text-muted-foreground">Loading…</p>}
      {!loading && threads.length === 0 && (
        <section className="px-5 mt-6">
          <div className="card-surface p-8 text-center">
            <Inbox className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-3 font-semibold">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              When you send a quote via Quottr or Email, customer replies will appear here.
            </p>
          </div>
        </section>
      )}

      <ul className="px-5 mt-4 space-y-2 pb-24">
        {threads.map((t) => (
          <li key={t.quote_id}>
            <Link
              to="/quotes/$quoteId"
              params={{ quoteId: t.quote_id }}
              search={{ tab: "messages" } as any}
              className="card-surface p-4 flex items-start gap-3"
            >
              <div className="h-10 w-10 rounded-full bg-lime/30 flex items-center justify-center shrink-0">
                <MessageSquare className="h-4 w-4 text-ink" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold truncate">
                    {t.last.sender === "customer" ? "Customer" : t.last.sender === "system" ? "Auto-reply" : "You"}
                  </p>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(t.last.created_at).toLocaleString([], {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
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
    </AppShell>
  );
}

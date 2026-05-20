import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPortalData, postPortalMessage } from "@/lib/messages.functions";
import { supabase } from "@/integrations/supabase/client";
import { QuottrLogo } from "@/components/QuottrLogo";
import { BusinessLogo } from "@/components/BusinessLogo";
import { Loader2, Send, Check, ThumbsUp, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/portal/$token")({
  component: PortalPage,
});

function formatGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);
}

function PortalPage() {
  const { token } = Route.useParams();
  const fetchData = useServerFn(getPortalData);
  const postMsg = useServerFn(postPortalMessage);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const r = await fetchData({ data: { token } });
      setData(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load quote");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [token]);

  // Realtime updates for new messages
  useEffect(() => {
    if (!data?.quote?.id) return;
    const ch = supabase
      .channel(`portal-${data.quote.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "quote_messages", filter: `quote_id=eq.${data.quote.id}` },
        (payload) => {
          setData((prev: any) => prev ? { ...prev, messages: [...prev.messages, payload.new] } : prev);
        })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [data?.quote?.id]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [data?.messages?.length]);

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setBody("");
    try {
      await postMsg({ data: { token, body: text } });
    } catch (e) {
      setBody(text);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !data?.quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper px-6 text-center">
        <div>
          <h1 className="text-2xl mb-2">Link not valid</h1>
          <p className="text-sm text-muted-foreground">{error ?? "This portal link has expired."}</p>
        </div>
      </div>
    );
  }

  const { quote, profile, client, messages } = data;
  const lineItems = (quote.line_items as any[]) ?? [];

  return (
    <div className="min-h-screen bg-paper pb-32">
      <header className="bg-ink text-paper px-5 pt-6 pb-5 flex items-center gap-3">
        <BusinessLogo logoUrl={(profile as any)?.logo_url} businessName={profile?.business_name ?? "Your tradesperson"} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate">{profile?.business_name ?? "Your tradesperson"}</p>
          <p className="text-[10px] text-paper/60 truncate">Quote {quote.ref ?? ""}</p>
        </div>
        <QuottrLogo className="h-5 w-auto opacity-60" />
      </header>

      <section className="px-5 mt-5">
        <h1 className="text-2xl leading-tight">{quote.title}</h1>
        {client?.name && <p className="text-sm text-muted-foreground mt-1">For {client.name}</p>}
      </section>

      {quote.job_description && (
        <section className="px-5 mt-4">
          <div className="card-surface p-5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Job description</p>
            <p className="text-sm mt-2 leading-relaxed whitespace-pre-line">{quote.job_description}</p>
          </div>
        </section>
      )}

      <section className="px-5 mt-4">
        <div className="card-surface overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Itemised</p>
          </div>
          <ul>
            {lineItems.map((li, i) => (
              <li key={i} className="px-5 py-3 flex items-start gap-3 border-t border-border first:border-t-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{li.description}</p>
                  <p className="text-xs text-muted-foreground">{li.qty} × {formatGBP(li.unit_price)}</p>
                </div>
                <p className="num text-base">{formatGBP((li.qty || 0) * (li.unit_price || 0))}</p>
              </li>
            ))}
          </ul>
          <div className="px-5 py-4 border-t border-border bg-secondary/40 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="num">{formatGBP(quote.subtotal)}</span>
            </div>
            {quote.vat_registered && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">VAT (20%)</span>
                <span className="num">{formatGBP(quote.vat_amount)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-border">
              <span className="text-sm uppercase tracking-widest font-semibold">Total</span>
              <span className="num text-3xl text-ink">{formatGBP(quote.total)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Messaging */}
      <section className="px-5 mt-5">
        <div className="flex items-center gap-2 mb-2.5">
          <MessageSquare className="h-4 w-4" />
          <h2 className="text-xl">Messages</h2>
        </div>
        <div className="card-surface p-3">
          <div ref={threadRef} className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Ask a question and {profile?.business_name ?? "your tradesperson"} will reply here.
              </p>
            )}
            {messages.map((m: any) => (
              <MessageBubble key={m.id} m={m} mine={m.sender === "customer"} />
            ))}
          </div>
        </div>
      </section>

      {/* Composer */}
      <div className="fixed inset-x-0 bottom-0 bg-paper border-t border-border p-3 safe-bottom">
        <div className="max-w-md mx-auto flex items-center gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="Type a message…"
            className="flex-1 bg-secondary rounded-full px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-lime/40"
          />
          <button
            onClick={send}
            disabled={sending || !body.trim()}
            className="h-11 w-11 rounded-full bg-lime text-ink inline-flex items-center justify-center disabled:opacity-50"
            aria-label="Send"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ m, mine }: { m: any; mine: boolean }) {
  if (m.sender === "system") {
    return (
      <div className="text-center">
        <span className="inline-block text-[11px] text-muted-foreground bg-secondary rounded-full px-3 py-1">
          {m.body}
        </span>
      </div>
    );
  }
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-lime text-ink" : "bg-secondary text-ink"}`}>
        <p className="whitespace-pre-wrap break-words">{m.body}</p>
        <p className={`text-[10px] mt-1 ${mine ? "text-ink/60" : "text-muted-foreground"}`}>
          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

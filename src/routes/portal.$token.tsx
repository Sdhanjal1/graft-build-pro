import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPortalData, respondToQuoteByToken } from "@/lib/messages.functions";
import { QuottrLogo } from "@/components/QuottrLogo";
import { BusinessLogo } from "@/components/BusinessLogo";
import { Loader2, Check, X } from "lucide-react";

export const Route = createFileRoute("/portal/$token")({
  component: PortalPage,
});

function formatGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);
}

function PortalPage() {
  const { token } = Route.useParams();
  const fetchData = useServerFn(getPortalData);
  const respond = useServerFn(respondToQuoteByToken);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [responding, setResponding] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetchData({ data: { token } });
      setData(r);
      setStatus(r.quote?.status ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load quote");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [token]);

  const onRespond = async (response: "accepted" | "declined") => {
    if (response === "declined" && !confirm("Decline this quote?")) return;
    setResponding(true);
    try {
      const r = await respond({ data: { token, response } });
      setStatus(r.status);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not update quote");
    } finally {
      setResponding(false);
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

  const { quote, profile, client } = data;
  const lineItems = (quote.line_items as any[]) ?? [];
  const canRespond = status === "pending" || status === "sent";
  const showBottomBar = canRespond || status === "accepted" || status === "declined";

  return (
    <div className={`min-h-screen bg-paper ${showBottomBar ? "pb-28" : ""}`}>
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

      {status === "accepted" && (
        <section className="px-5 mt-4">
          <div className="rounded-2xl bg-status-accepted/15 text-status-accepted px-4 py-3 text-sm font-semibold flex items-center gap-2">
            <Check className="h-4 w-4" /> You accepted this quote. {profile?.business_name ?? "Your tradesperson"} has been notified.
          </div>
        </section>
      )}
      {status === "declined" && (
        <section className="px-5 mt-4">
          <div className="rounded-2xl bg-muted text-muted-foreground px-4 py-3 text-sm flex items-center gap-2">
            <X className="h-4 w-4" /> You declined this quote.
          </div>
        </section>
      )}

      <footer className="text-center mt-8 mb-4 text-[10px] text-muted-foreground">
        <a href="https://quottr.co.uk" className="inline-flex items-center gap-1">
          Powered by <QuottrLogo className="h-3 w-auto" />
        </a>
      </footer>

      {showBottomBar && (
        <div className="fixed inset-x-0 bottom-0 bg-paper border-t border-border p-3 safe-bottom">
          <div className="max-w-md mx-auto">
            {canRespond ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRespond("declined")}
                  disabled={responding}
                  className="flex-1 h-12 rounded-full border border-border text-ink text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <X className="h-4 w-4" /> Decline
                </button>
                <button
                  onClick={() => onRespond("accepted")}
                  disabled={responding}
                  className="flex-[2] h-12 rounded-full bg-lime text-ink text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {responding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Accept quote
                </button>
              </div>
            ) : status === "accepted" ? (
              <div className="h-12 rounded-full bg-status-accepted/15 text-status-accepted text-sm font-bold inline-flex items-center justify-center gap-1.5 w-full">
                <Check className="h-4 w-4" /> Accepted
              </div>
            ) : (
              <div className="h-12 rounded-full bg-muted text-muted-foreground text-sm font-semibold inline-flex items-center justify-center gap-1.5 w-full">
                Declined
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

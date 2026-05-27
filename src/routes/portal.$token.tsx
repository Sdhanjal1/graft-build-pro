import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPortalData, respondToQuoteByToken } from "@/lib/messages.functions";
import { createPortalCheckout } from "@/lib/payments.functions";
import { QuottrLogo } from "@/components/QuottrLogo";
import { BusinessLogo } from "@/components/BusinessLogo";
import { WalletBadges } from "@/components/WalletBadges";
import { downloadPortalPdf } from "@/lib/portal-pdf";
import { Loader2, Check, X, Download } from "lucide-react";
import { acceptButtonLabel, paymentTimingLabel, type PaymentTiming } from "@/lib/payment-timing";

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
  const startCheckout = useServerFn(createPortalCheckout);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [responding, setResponding] = useState(false);
  const [paying, setPaying] = useState(false);
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

  const onPay = async (requestType: "deposit" | "full") => {
    setPaying(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const r = await startCheckout({ data: { token, requestType, returnOrigin: origin } });
      window.location.href = r.url;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not start payment");
      setPaying(false);
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
          <h1 className="text-2xl mb-2">Quote link expired</h1>
          <p className="text-sm text-muted-foreground">
            This quote link is no longer active. Please contact your tradesperson for an updated link.
          </p>
        </div>
      </div>
    );
  }


  const { quote, profile, client, payment } = data;
  const lineItems = (quote.line_items as any[]) ?? [];
  const isPaid = status === "paid";
  const canRespond = status === "pending" || status === "sent";
  const timing: PaymentTiming = (quote.payment_timing as PaymentTiming) ?? "on_completion";
  const total = Number(quote.total) || 0;
  const depositExplicit = Number(quote.deposit_amount) || 0;
  const depositPct = Number(quote.deposit_percent) || 0;
  const depositAmount =
    depositExplicit > 0
      ? depositExplicit
      : depositPct > 0
      ? +(total * (depositPct / 100)).toFixed(2)
      : +(total * 0.5).toFixed(2);
  const canPayNow =
    status === "accepted" && !isPaid && (timing === "upfront" || timing === "staged" || timing === "on_completion");
  const payRequestType: "deposit" | "full" =
    timing === "staged" ? "deposit" : "full";
  const payAmount = payRequestType === "deposit" ? depositAmount : total;
  const showBottomBar = canRespond || status === "accepted" || status === "declined" || isPaid;

  const handleDownloadInvoice = async () => {
    try {
      await downloadPortalPdf(
        {
          ref: quote.ref,
          title: quote.title,
          job_description: quote.job_description,
          line_items: lineItems,
          subtotal: Number(quote.subtotal) || 0,
          vat_amount: Number(quote.vat_amount) || 0,
          total: Number(quote.total) || 0,
          vat_registered: quote.vat_registered,
          created_at: quote.created_at,
          paid_at: payment?.paid_at ?? null,
          payment_method: payment?.payment_method ?? "card",
          stripe_payment_intent: payment?.stripe_payment_intent ?? null,
        },
        client,
        profile,
        "invoice",
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not generate PDF");
    }
  };

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
                  <p className="text-xs text-muted-foreground">{(li as any).unit === "hours" ? `${li.qty} ${li.qty === 1 ? "hr" : "hrs"}` : (li as any).unit === "days" ? `${li.qty} ${li.qty === 1 ? "day" : "days"}` : li.qty} × {formatGBP(li.unit_price)}{(li as any).unit === "hours" ? "/hr" : (li as any).unit === "days" ? "/day" : ""}</p>
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
            <p className="text-xs text-muted-foreground pt-1">
              {paymentTimingLabel({
                timing: (quote.payment_timing as PaymentTiming) ?? "on_completion",
                total: Number(quote.total) || 0,
                depositAmount: Number(quote.deposit_amount) || 0,
                depositPercent: Number(quote.deposit_percent) || 0,
              })}
            </p>
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
      {isPaid && (
        <section className="px-5 mt-4">
          <div className="card-surface p-5 border-2 border-status-accepted/30 bg-status-accepted/5">
            <div className="flex items-center gap-2 text-status-accepted font-bold text-sm">
              <Check className="h-4 w-4" /> Paid in full
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Thanks for your payment. A copy of your invoice has been emailed to you.
            </p>
            <button
              type="button"
              onClick={handleDownloadInvoice}
              className="mt-3 w-full h-11 rounded-full bg-ink text-paper text-sm font-bold inline-flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" /> Download invoice PDF
            </button>
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
                  className="flex-[2] h-12 rounded-full bg-lime text-ink text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 px-3"
                >
                  {responding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  <span className="truncate">
                    {acceptButtonLabel({
                      timing: (quote.payment_timing as PaymentTiming) ?? "on_completion",
                      total: Number(quote.total) || 0,
                      depositAmount: Number(quote.deposit_amount) || 0,
                    })}
                  </span>
                </button>
              </div>
            ) : isPaid ? (
              <div className="h-12 rounded-full bg-status-accepted/15 text-status-accepted text-sm font-bold inline-flex items-center justify-center gap-1.5 w-full">
                <Check className="h-4 w-4" /> Paid
              </div>
            ) : status === "accepted" ? (
              canPayNow ? (
                <div className="space-y-2">
                  <button
                    onClick={() => onPay(payRequestType)}
                    disabled={paying}
                    className="w-full h-12 rounded-full bg-lime text-ink text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 px-3 active:scale-[0.99] transition"
                  >
                    {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    <span className="truncate">
                      {payRequestType === "deposit" ? "Pay deposit" : "Pay now"} {formatGBP(payAmount)}
                    </span>
                  </button>
                  <p className="text-center text-[10px] text-muted-foreground">
                    Secured payment by Stripe
                  </p>
                  <WalletBadges />
                </div>

              ) : (
                <div className="h-12 rounded-full bg-status-accepted/15 text-status-accepted text-sm font-bold inline-flex items-center justify-center gap-1.5 w-full">
                  <Check className="h-4 w-4" /> Accepted
                </div>
              )
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

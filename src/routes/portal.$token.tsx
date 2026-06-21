import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPortalData, respondToQuoteByToken } from "@/lib/messages.functions";
import { createPortalCheckout } from "@/lib/payments.functions";
import { BusinessLogo } from "@/components/BusinessLogo";
import { WalletBadges } from "@/components/WalletBadges";
import { downloadPortalPdf } from "@/lib/portal-pdf";
import { Loader2, Check, X, Download, Copy, Landmark, CreditCard } from "lucide-react";
import { acceptButtonLabel, paymentTimingLabel, type PaymentTiming } from "@/lib/payment-timing";
import { feedback } from "@/lib/feedback";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/portal/$token")({
  component: PortalPage,
  head: () => ({
    meta: [
      // Private per-customer link — keep the share preview minimal and personal,
      // and stop the marketing root OG card from bleeding into WhatsApp.
      { title: "Your quote" },
      { name: "description", content: "View, accept and pay your quote." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Your quote" },
      { property: "og:description", content: "View, accept and pay your quote." },
      { name: "twitter:title", content: "Your quote" },
      { name: "twitter:description", content: "View, accept and pay your quote." },
      // Override the root's large banner with a compact, on-brand icon so
      // WhatsApp renders a small preview instead of the marketing card.
      { name: "twitter:card", content: "summary" },
      { property: "og:image", content: "https://quottr.co.uk/app-icon.png" },
      { name: "twitter:image", content: "https://quottr.co.uk/app-icon.png" },
    ],
  }),
});

function formatGBP(n: number) {
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: safe < 1000 ? 2 : 0,
  }).format(safe);
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
  const [paymentResult, setPaymentResult] = useState<"paid" | "cancelled" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);

  const load = async () => {
    try {
      const r = await fetchData({ data: { token } });
      setData(r);
      setStatus(r.quote?.status ?? null);
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load quote");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const [autoPay, setAutoPay] = useState<"balance" | null>(null);

  useEffect(() => {
    // Read ?paid / ?cancelled / ?pay BEFORE first load, then clean URL.
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const paid = params.get("paid");
      const cancelled = params.get("cancelled");
      const pay = params.get("pay");
      if (paid === "1") {
        setPaymentResult("paid");
        setConfirming(true);
      } else if (cancelled === "1") {
        setPaymentResult("cancelled");
      }
      if (pay === "balance") setAutoPay("balance");
      if (paid || cancelled || pay) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
    void load();
    /* eslint-disable-next-line */
  }, [token]);

  // Poll for webhook confirmation after a paid redirect.
  // Deposit payments flip the quote to "accepted" (not "paid"), so we accept
  // either state — otherwise the spinner runs for 30s and disappears with no
  // success state for deposit flows.
  useEffect(() => {
    if (paymentResult !== "paid") return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 15; // 15 × 2s = 30s
    const tick = async () => {
      if (cancelled) return;
      attempts++;
      const r = await load();
      const s = r?.quote?.status;
      if (s === "paid" || s === "accepted") {
        setConfirming(false);
        return;
      }
      if (attempts >= maxAttempts) {
        setConfirming(false);
        return;
      }
      window.setTimeout(tick, 2000);
    };
    window.setTimeout(tick, 2000);
    return () => { cancelled = true; };
    /* eslint-disable-next-line */
  }, [paymentResult]);


  const onPay = async (requestType: "deposit" | "full" | "balance") => {
    setPaying(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const r = await startCheckout({ data: { token, requestType, returnOrigin: origin } });
      window.location.href = r.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start payment");
      setPaying(false);
    }
  };

  // Auto-open Stripe Checkout for ?pay=balance email deep-links. Fires once
  // after the quote loads and only when the deposit-paid + balance-due
  // state is real (server data, not just the query param).
  useEffect(() => {
    if (autoPay !== "balance") return;
    if (loading || !data?.quote) return;
    const s = data.quote.status as string | null;
    const pay = data.payment;
    const depositPaid = pay?.status === "paid" && pay?.request_type === "deposit";
    const hasCardEnabled = !!(data.profile as any)?.stripe_connect_charges_enabled;
    if (s !== "paid" && depositPaid && hasCardEnabled) {
      setAutoPay(null);
      void onPay("balance");
    } else {
      setAutoPay(null);
    }
    /* eslint-disable-next-line */
  }, [autoPay, loading, data]);

  const onRespond = async (response: "accepted" | "declined") => {
    if (response === "declined") {
      setDeclineOpen(true);
      return;
    }
    await performRespond(response);
  };

  const performRespond = async (response: "accepted" | "declined") => {
    setResponding(true);
    try {
      const r = await respond({ data: { token, response } });
      setStatus(r.status);
      // Auto-redirect to Stripe checkout for upfront/deposit when card is set up.
      if (response === "accepted") {
        const t: PaymentTiming = (data?.quote?.payment_timing as PaymentTiming) ?? "on_completion";
        const cardEnabled = !!(data?.profile as any)?.stripe_connect_charges_enabled;
        if ((t === "upfront" || t === "deposit_then_balance") && cardEnabled) {
          const reqType: "deposit" | "full" = t === "deposit_then_balance" ? "deposit" : "full";
          await onPay(reqType);
          return;
        }
        // Bank-only fallback: nudge them to the bank card already on screen.
        const bankAccountSet = !!((data?.profile as any)?.account_number?.toString().trim());
        const bankSortSet = !!((data?.profile as any)?.sort_code?.toString().trim());
        if ((t === "upfront" || t === "deposit_then_balance") && bankAccountSet && bankSortSet) {
          toast.success("Quote accepted — transfer using the bank details below.");
          if (typeof window !== "undefined") {
            window.setTimeout(() => {
              document.getElementById("how-to-pay")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 100);
          }
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update quote");
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
  // "Paid in full" must require an authoritative server signal — never
  // infer it from the ?paid=1 redirect param (that fires for deposits too).
  // Any other state renders a balance-due affordance.
  const isPaidInFull = status === "paid";
  // Used only for the top-of-page "Payment received — thank you" card,
  // which is intentionally optimistic on redirect.
  const isPaid = isPaidInFull || paymentResult === "paid";
  // A paid deposit exists when the server returned a paid invoice_payments
  // row whose request_type is "deposit". Pending rows (abandoned checkouts)
  // are filtered out at the loader (.eq("status","paid")).
  const hasPaidDeposit =
    payment?.status === "paid" && payment?.request_type === "deposit";
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
      : +(total * 0.3).toFixed(2);
  const hasCard = !!(profile as any)?.stripe_connect_charges_enabled;
  const bankAccount = ((profile as any)?.account_number ?? "").toString().trim();
  const bankSort = ((profile as any)?.sort_code ?? "").toString().trim();
  const hasBank = !!bankAccount && !!bankSort;
  const isInvoiced = !!(quote as any).invoiced_at || status === "invoiced";
  const isUpfrontOrDeposit = timing === "upfront" || timing === "deposit_then_balance";
  // For on_completion quotes, only surface pay-now options once the trader has issued the invoice.
  const timingAllowsPayNow =
    isUpfrontOrDeposit || (timing === "on_completion" && isInvoiced);
  // Whether we can offer a card payment right now (pre- or post-accept).
  const canPayNow = !isPaid && timingAllowsPayNow && hasCard;
  // For upfront/deposit timings, surface payment instructions as soon as the
  // quote is opened so the customer can see how they'll pay before accepting.
  const showPaymentOptions =
    !isPaid &&
    timingAllowsPayNow &&
    status !== "declined" &&
    (hasCard || hasBank) &&
    (isUpfrontOrDeposit || status === "accepted");
  const showNoMethodFallback =
    status === "accepted" && !isPaid && timingAllowsPayNow && !hasCard && !hasBank;
  const isPreAccept = status !== "accepted" && status !== "paid";
  const isDepositFlow = timing === "deposit_then_balance";
  const payRequestType: "deposit" | "full" = isDepositFlow ? "deposit" : "full";
  const payAmount = isDepositFlow ? depositAmount : total;
  const balanceAmount = Math.max(0, +(total - payAmount).toFixed(2));

  const showBottomBar = canRespond || status === "accepted" || status === "declined" || isPaid;

  const paymentRef = ((profile as any)?.payment_reference_note ?? "").toString().trim() || (quote.ref ?? "");
  const accountName = ((profile as any)?.bank_account_name ?? "").toString().trim() || (profile?.business_name ?? "");
  const bankName = ((profile as any)?.bank_name ?? "").toString().trim();
  const formattedSort = bankSort.replace(/\D/g, "").replace(/(\d{2})(?=\d)/g, "$1-");

  const handleCopyBank = async () => {
    const lines = [
      accountName ? `Account name: ${accountName}` : null,
      bankName ? `Bank: ${bankName}` : null,
      `Sort code: ${formattedSort}`,
      `Account number: ${bankAccount}`,
      paymentRef ? `Reference: ${paymentRef}` : null,
      `Amount: ${formatGBP(payAmount)}`,
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      feedback("tap");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

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
      toast.error(e instanceof Error ? e.message : "Could not generate PDF");
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
      </header>

      {paymentResult === "paid" && (() => {
        // Deposit flow: webhook marks the quote "accepted" (not "paid"), so a
        // returning customer who paid only a deposit should see deposit-
        // specific copy and no "download invoice" button — there isn't one yet.
        const isDepositOnly = !isPaid && status === "accepted" && isDepositFlow;
        return (
          <section className="px-5 mt-5">
            <div className="card-surface p-6 text-center border-2 border-paid/40 bg-paid-bg">
              <div className="h-14 w-14 rounded-full bg-paid text-paper inline-flex items-center justify-center mb-3">
                <Check className="h-7 w-7" strokeWidth={3} />
              </div>
              <h2 className="text-2xl leading-tight">
                {isDepositOnly ? "Deposit received — thank you!" : "Payment received — thank you!"}
              </h2>
              {isDepositOnly ? (
                <>
                  <p className="text-sm text-muted-foreground mt-2">
                    Your tradesperson has been notified.
                  </p>
                  <div className="mt-3 inline-flex flex-col items-center gap-0.5">
                    <p className="num text-3xl leading-none">
                      {formatGBP(payAmount)} <span className="text-base text-muted-foreground font-normal">paid</span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="num font-semibold text-ink">{formatGBP(balanceAmount)}</span> due on completion
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Job total <span className="num text-ink">{formatGBP(total)}</span>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mt-2">
                    A receipt and invoice have been emailed to you.
                  </p>
                  <p className="num text-3xl mt-3">{formatGBP(payAmount)}</p>
                </>
              )}
              {confirming && !isPaid && !isDepositOnly && (
                <p className="text-xs text-muted-foreground mt-3 inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Confirming with your tradesperson…
                </p>
              )}
              {isPaid && (
                <button
                  type="button"
                  onClick={handleDownloadInvoice}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-ink text-paper px-5 h-11 text-sm font-bold"
                >
                  <Download className="h-4 w-4" /> Download invoice PDF
                </button>
              )}
            </div>
          </section>
        );
      })()}

      {paymentResult === "cancelled" && (
        <section className="px-5 mt-5">
          <div className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground flex items-start gap-2">
            <X className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Payment cancelled — you can try again when ready.</span>
          </div>
        </section>
      )}


      <section className="px-5 mt-5">
        <h1 className="text-2xl leading-tight">{quote.title}</h1>
        {client?.name && <p className="text-sm text-muted-foreground mt-1">For {client.name}</p>}
      </section>

      {quote.job_description && (
        <section className="px-5 mt-4">
          <p className="text-sm leading-relaxed whitespace-pre-line text-ink/90">{quote.job_description}</p>
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
                  {(li as any).category !== "labour" && (li as any).category !== "cis_labour" && (
                    <p className="text-xs text-muted-foreground">{(li as any).unit === "hours" ? `${li.qty} ${li.qty === 1 ? "hr" : "hrs"}` : (li as any).unit === "days" ? `${li.qty} ${li.qty === 1 ? "day" : "days"}` : li.qty} × {formatGBP(li.unit_price)}{(li as any).unit === "hours" ? "/hr" : (li as any).unit === "days" ? "/day" : ""}</p>
                  )}
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
          <div className="px-5 py-4 border-t border-border">
            <div className="rounded-2xl border-2 border-lime bg-lime/10 px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">Payment terms</p>
              <p className="text-base font-bold text-ink leading-tight">
                {paymentTimingLabel({
                  timing: (quote.payment_timing as PaymentTiming) ?? "on_completion",
                  total: Number(quote.total) || 0,
                  depositAmount: Number(quote.deposit_amount) || 0,
                  depositPercent: Number(quote.deposit_percent) || 0,
                })}
              </p>
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

      {showPaymentOptions && (
        <section id="how-to-pay" className="px-5 mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">How to pay</p>
            {isPreAccept && (
              <span className="text-[10px] uppercase tracking-widest font-semibold bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">Preview</span>
            )}
          </div>

          {canPayNow && (
            <div className="card-surface p-5">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-4 w-4 text-ink" />
                <p className="text-sm font-bold text-ink">Pay by card</p>
              </div>
              {isPreAccept ? (
                <>
                  <p className="text-center text-[11px] text-muted-foreground">
                    Available after you accept.
                  </p>
                  <p className="text-center text-[10px] text-muted-foreground mt-2">Secured payment by Stripe</p>
                  <WalletBadges className="mt-2" />
                </>
              ) : (
                <>
                  <button
                    onClick={() => onPay(payRequestType)}
                    onPointerDown={() => feedback("tap")}
                    disabled={paying || responding}
                    className="w-full h-12 rounded-full bg-lime text-ink text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 px-3 active:scale-[0.99] transition"
                  >
                    {(paying || responding) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    <span className="truncate">
                      {`${isDepositFlow ? "Pay deposit" : "Pay now"} ${formatGBP(payAmount)}`}
                    </span>
                  </button>
                  {isDepositFlow && (
                    <p className="text-center text-[11px] text-muted-foreground mt-2">Balance of {formatGBP(balanceAmount)} due on completion.</p>
                  )}
                  <p className="text-center text-[10px] text-muted-foreground mt-2">Secured payment by Stripe</p>
                  <WalletBadges className="mt-2" />
                </>
              )}
            </div>
          )}



          {hasBank && (
            <div className="card-surface p-5">
              <div className="flex items-center gap-2 mb-3">
                <Landmark className="h-4 w-4 text-ink" />
                <p className="text-sm font-bold text-ink">Pay by bank transfer</p>
              </div>
              <dl className="text-sm divide-y divide-border rounded-xl border border-border overflow-hidden">
                {accountName && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <dt className="text-muted-foreground">Account name</dt>
                    <dd className="font-medium text-ink text-right truncate ml-3">{accountName}</dd>
                  </div>
                )}
                {bankName && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <dt className="text-muted-foreground">Bank</dt>
                    <dd className="font-medium text-ink text-right truncate ml-3">{bankName}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between px-3 py-2">
                  <dt className="text-muted-foreground">Sort code</dt>
                  <dd className="num font-medium text-ink">{formattedSort}</dd>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <dt className="text-muted-foreground">Account number</dt>
                  <dd className="num font-medium text-ink">{bankAccount}</dd>
                </div>
                {paymentRef && (
                  <div className="flex items-center justify-between px-3 py-2 bg-lime/10">
                    <dt className="text-muted-foreground">Reference</dt>
                    <dd className="num font-bold text-ink">{paymentRef}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between px-3 py-3 bg-ink text-paper">
                  <dt className="text-paper/70">{isDepositFlow ? "Deposit due now" : "Amount"}</dt>
                  <dd className="num font-bold text-paper text-lg">{formatGBP(payAmount)}</dd>
                </div>
              </dl>
              {isDepositFlow && (
                <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                  Balance of {formatGBP(balanceAmount)} due on completion.
                </p>
              )}
              <button
                type="button"
                onClick={handleCopyBank}
                className="mt-3 w-full h-11 rounded-full bg-ink text-paper text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy details"}
              </button>
              <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                Once you've sent the transfer, your tradesperson will mark it as paid.
              </p>
            </div>
          )}
        </section>
      )}

      {showNoMethodFallback && (
        <section className="px-5 mt-4">
          <div className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            Your tradesperson hasn't set up online payments yet — they'll be in touch with payment details.
          </div>
        </section>
      )}

      {isPaidInFull && (
        <section className="px-5 mt-4">
          <div className="card-surface p-5 border-2 border-paid/30 bg-paid-bg">
            <div className="flex items-center gap-2 text-paid-text font-bold text-sm">
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

      {!isPaidInFull && hasPaidDeposit && paymentResult !== "paid" && (
        <section className="px-5 mt-4">
          <div className="card-surface p-5 border-2 border-paid/40 bg-paid-bg">
            <div className="flex items-center gap-2 text-paid-text font-bold text-sm">
              <Check className="h-4 w-4" /> Deposit paid
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Balance of <span className="num font-semibold text-ink">{formatGBP(balanceAmount)}</span> due on completion.
            </p>
          </div>
        </section>
      )}



      <footer className={`text-center mt-8 text-[10px] text-muted-foreground ${showBottomBar ? "mb-28" : "mb-4"}`}>
        <a href="https://quottr.co.uk" className="hover:underline">
          Powered by <span className="text-lime">Quottr</span>
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
                  aria-label="Decline quote"
                  className="w-24 h-12 rounded-full border border-border text-ink text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0"
                >
                  <X className="h-4 w-4" /> No
                </button>
                <button
                  onClick={() => onRespond("accepted")}
                  onPointerDown={() => feedback("tap")}
                  disabled={responding}
                  className="flex-1 h-12 rounded-full bg-lime text-ink text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 px-3"
                >
                  {responding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  <span className="truncate">
                    {hasCard || hasBank
                      ? acceptButtonLabel({
                          timing: (quote.payment_timing as PaymentTiming) ?? "on_completion",
                          total: Number(quote.total) || 0,
                          depositAmount: Number(quote.deposit_amount) || 0,
                        })
                      : "Accept quote"}
                  </span>
                </button>
              </div>
            ) : paymentResult === "paid" && !isPaidInFull && !hasPaidDeposit ? (
              <div className="h-12 rounded-full bg-status-accepted/15 text-status-accepted text-sm font-bold inline-flex items-center justify-center gap-1.5 w-full">
                <Loader2 className="h-4 w-4 animate-spin" /> Confirming payment…
              </div>
            ) : isPaidInFull ? (
              <div className="h-12 rounded-full bg-status-accepted/15 text-status-accepted text-sm font-bold inline-flex items-center justify-center gap-1.5 w-full">
                <Check className="h-4 w-4" /> Paid
              </div>
            ) : hasPaidDeposit && !isPaidInFull ? (
              hasCard && balanceAmount > 0 ? (
                <button
                  onClick={() => onPay("balance")}
                  onPointerDown={() => feedback("tap")}
                  disabled={paying}
                  className="w-full h-12 rounded-full bg-lime text-ink text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 px-3 active:scale-[0.99] transition"
                >
                  {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  <span className="truncate">Pay balance {formatGBP(balanceAmount)}</span>
                </button>
              ) : (
                <div className="h-12 px-4 rounded-full bg-status-accepted/15 text-status-accepted text-sm font-bold inline-flex items-center justify-center gap-1.5 w-full">
                  <Check className="h-4 w-4" />
                  <span className="truncate">Deposit paid · <span className="num">{formatGBP(balanceAmount)}</span> due on completion</span>
                </div>
              )
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

      <AlertDialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this quote?</AlertDialogTitle>
            <AlertDialogDescription>
              Your tradesperson will be notified that you've declined.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setDeclineOpen(false); void performRespond("declined"); }}
              className="bg-status-overdue text-paper hover:bg-status-overdue/90"
            >
              Decline quote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import {
  getQuote, getClient, userProfile, formatGBP,
  buildInvoiceMessage, stripePaymentLink, buildPaymentRequest,
  duplicateQuote, buildDepositOnAcceptMessage, markInvoiced, ensureChasesFor,
  setQuoteStatus, updateQuoteLineItems,
  type PaymentMethod, type PaymentRequest, type PaymentRequestType, type Quote, type LineItem,
} from "@/lib/user-data";
import { createInvoiceCheckout } from "@/lib/payments.functions";
import { getPortalLinkStatusForQuote, regeneratePortalCode } from "@/lib/portal.functions";
import { MessageCircle, Mail, Phone, CreditCard, Landmark, Banknote, Check, CheckCircle2, Zap, Loader2, ThumbsUp, Copy, FileText, Share2, Send, XCircle, MessageSquare, Smartphone, Nfc, AlertTriangle } from "lucide-react";
import { QuottrLogo } from "@/components/QuottrLogo";
import { BusinessLogo } from "@/components/BusinessLogo";
import { downloadOrShareQuotePdf } from "@/lib/pdf";
import { toast } from "sonner";
import { feedback } from "@/lib/feedback";
import { SendQuoteDialog } from "@/components/SendQuoteDialog";
import { AssignClientDialog } from "@/components/AssignClientDialog";
import { listQuoteMessages, sendProMessage } from "@/lib/messages.functions";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef } from "react";
import { usePaidQuoteCount, useInvalidatePaidQuoteCount, normalizeSource } from "@/hooks/usePaidQuoteCount";

function celebratePaid(amount: number) {
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio("/cash.mp3");
    audio.volume = 0.7;
    void audio.play().catch(() => {});
  } catch { /* noop */ }
  void import("canvas-confetti").then(({ default: confetti }) => {
    try {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ["#c8e04a", "#0a0a0a", "#ffffff"] });
      setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.55 } }), 180);
    } catch { /* noop */ }
  }).catch(() => {});
  toast.success(`${formatGBP(amount)} in. Nice.`);
}

export const Route = createFileRoute("/quotes/$quoteId")({
  component: QuoteDetail,
  notFoundComponent: () => <div className="p-8 text-center">Quote not found</div>,
});

function QuoteDetail() {
  const { quoteId } = Route.useParams();
  const quote = getQuote(quoteId);
  if (!quote) throw notFound();
  const client = getClient(quote.client_id);

  // Local state so the mock UI updates instantly. Mutates the mock object
  // so the change persists across navigation within the session.
  const [method, setMethodState] = useState<PaymentMethod>(quote.payment_method ?? "card");
  const [status, setStatusState] = useState(quote.status);
  const [paidVia, setPaidViaState] = useState(quote.paid_via);
  const [askingPaid, setAskingPaid] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [customAmt, setCustomAmt] = useState("");
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | undefined>(quote.payment_request);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // (scheduling removed)
  const [askDeposit, setAskDeposit] = useState(false);
  const [askInvoice, setAskInvoice] = useState(false);
  const [invoicedAt, setInvoicedAt] = useState<string | undefined>(quote.invoiced_at);
  const [sendOpen, setSendOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [portalStatus, setPortalStatus] = useState<{
    client_id: string;
    portal_code: string | null;
    days_remaining: number;
    expired: boolean;
  } | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [updatedLinkCode, setUpdatedLinkCode] = useState<string | undefined>(undefined);
  const navigate = useNavigate();
  // (schedule defaults removed)

  const createCheckout = useServerFn(createInvoiceCheckout);
  const fetchPortalStatus = useServerFn(getPortalLinkStatusForQuote);
  const regeneratePortalCodeFn = useServerFn(regeneratePortalCode);

  useEffect(() => {
    let cancelled = false;
    fetchPortalStatus({ data: { quoteId: quote.id } })
      .then((s) => {
        if (!cancelled && s) {
          setPortalStatus({
            client_id: s.client_id,
            portal_code: s.portal_code,
            days_remaining: s.days_remaining,
            expired: s.expired,
          });
        }
      })
      .catch(() => { /* non-blocking */ });
    return () => { cancelled = true; };
  }, [quote.id, fetchPortalStatus]);

  const handleRegenerateAndResend = async () => {
    if (!portalStatus) return;
    try {
      setRegenerating(true);
      const { portal_code } = await regeneratePortalCodeFn({ data: { clientId: portalStatus.client_id } });
      setPortalStatus({ ...portalStatus, portal_code, days_remaining: 90, expired: false });
      setUpdatedLinkCode(portal_code);
      setSendOpen(true);
      feedback("success");
    } catch (e) {
      feedback("error");
      toast.error(e instanceof Error ? e.message : "Could not regenerate link");
    } finally {
      setRegenerating(false);
    }
  };

  const setMethod = (m: PaymentMethod) => { quote.payment_method = m; setMethodState(m); };
  const acceptQuote = async () => {
    try {
      await setQuoteStatus(quote.id, "accepted");
      setStatusState("accepted");
      setAskDeposit(true);
    } catch (e) {
      feedback("error"); toast.error(e instanceof Error ? e.message : "Could not update status");
    }
  };
  const markSent = async () => {
    try {
      await setQuoteStatus(quote.id, "sent");
      setStatusState("sent");
      feedback("success"); toast.success("Marked as sent");
    } catch (e) {
      feedback("error"); toast.error(e instanceof Error ? e.message : "Could not update status");
    }
  };
  const declineQuote = async () => {
    try {
      await setQuoteStatus(quote.id, "declined");
      setStatusState("declined");
      feedback("success"); toast.success("Quote declined");
    } catch (e) {
      feedback("error"); toast.error(e instanceof Error ? e.message : "Could not update status");
    }
  };
  // (confirmSchedule removed)
  const markPaid = (m: PaymentMethod) => {
    quote.paid_via = m; quote.status = "paid";
    setPaidViaState(m); setStatusState("paid"); setAskingPaid(false);
    setAskInvoice(true);
    feedback("success");
    celebratePaid(quote.total);
  };
  const duplicate = async () => {
    try {
      const copy = await duplicateQuote(quote.id);
      if (!copy) return;
      feedback("success"); toast.success(`Quote duplicated as ${copy.ref}`);
      navigate({ to: "/quotes/$quoteId", params: { quoteId: copy.id } });
    } catch (e) {
      feedback("error"); toast.error(e instanceof Error ? e.message : "Could not duplicate quote");
    }
  };
  const sendDepositRequest = () => {
    const firstName = client?.name.split(" ")[0] ?? "there";
    const { message } = buildDepositOnAcceptMessage(quote, firstName);
    const text = encodeURIComponent(message);
    const digits = client?.phone.replace(/\D/g, "");
    const wa = `https://wa.me/${digits ? "44" + digits.replace(/^0/, "") : ""}?text=${text}`;
    window.open(wa, "_blank");
    setAskDeposit(false);
  };
  const issueInvoice = async () => {
    try {
      const inv = await markInvoiced(quote.id);
      if (inv) {
        setInvoicedAt(inv.invoiced_at);
        ensureChasesFor(inv);
      }
      setAskInvoice(false);
      navigate({ to: "/invoices/$quoteId", params: { quoteId: quote.id } });
    } catch (e) {
      feedback("error"); toast.error(e instanceof Error ? e.message : "Could not issue invoice");
    }
  };
  const createPaymentRequest = async (type: PaymentRequestType, amount?: number) => {
    setCreating(true);
    setError(null);
    try {
      const amt =
        type === "deposit" ? quote.total * 0.5 :
        type === "full" ? quote.total :
        (amount ?? 0);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const result = await createCheckout({
        data: {
          quoteId: quote.id,
          quoteRef: quote.ref,
          title: quote.title,
          amount: amt,
          currency: "gbp",
          requestType: type,
          customerEmail: client?.email,
          successUrl: `${origin}/quotes/${quote.id}?paid=1`,
          cancelUrl: `${origin}/quotes/${quote.id}?cancelled=1`,
        },
      });
      const pr = buildPaymentRequest(quote, type, amount);
      pr.link = result.url;
      quote.payment_request = pr;
      quote.payment_method = "card";
      setPaymentRequest(pr);
      setMethodState("card");
      setRequesting(false);
      setCustomAmt("");
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Could not create Stripe payment link");
    } finally {
      setCreating(false);
    }
  };

  const [takingOnSite, setTakingOnSite] = useState(false);
  const takePaymentOnSite = async (type: PaymentRequestType, amount?: number) => {
    setTakingOnSite(true);
    setError(null);
    try {
      const amt =
        type === "deposit" ? quote.total * 0.5 :
        type === "full" ? quote.total :
        (amount ?? 0);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const result = await createCheckout({
        data: {
          quoteId: quote.id,
          quoteRef: quote.ref,
          title: quote.title,
          amount: amt,
          currency: "gbp",
          requestType: type,
          customerEmail: client?.email,
          successUrl: `${origin}/quotes/${quote.id}?paid=1`,
          cancelUrl: `${origin}/quotes/${quote.id}?cancelled=1`,
        },
      });
      // Open Stripe Checkout in the same window, Apple Pay / Google Pay
      // appear automatically on supported devices. The webhook will mark
      // the invoice as paid when the customer completes the sheet.
      window.location.href = result.url;
    } catch (e: any) {
      console.error(e);
      feedback("error");
      toast.error(e?.message ?? "Could not start payment");
      setTakingOnSite(false);
    }
  };



  const liveQuote: Quote = { ...quote, payment_method: method, status, paid_via: paidVia, payment_request: paymentRequest };
  const sharePdf = async () => {
    try {
      const r = await downloadOrShareQuotePdf(liveQuote, client, "quote");
      if (!r.shared && !r.cancelled) { feedback("success"); toast.success("Quote PDF downloaded"); }
    } catch (e) {
      feedback("error"); toast.error(e instanceof Error ? e.message : "Could not generate PDF");
    }
  };
  let primary: { label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void };
  if (status === "pending" || status === "declined") {
    primary = { label: "Send quote", icon: Send, onClick: () => setSendOpen(true) };
  } else if (status === "sent") {
    primary = { label: "Mark as accepted", icon: ThumbsUp, onClick: acceptQuote };
  } else if (status === "accepted") {
    primary = { label: "Mark job complete", icon: Check, onClick: () => setAskingPaid(true) };
  } else {
    primary = { label: "Share PDF", icon: Share2, onClick: sharePdf };
  }
  const PrimaryIcon = primary.icon;
  const messageBody = buildInvoiceMessage(liveQuote, client?.name.split(" ")[0] ?? "there");
  const encoded = encodeURIComponent(messageBody);
  const phoneDigits = client?.phone.replace(/\D/g, "");
  const waHref = `https://wa.me/${phoneDigits ? "44" + phoneDigits.replace(/^0/, "") : ""}?text=${encoded}`;
  const mailHref = `mailto:${client?.email}?subject=${encodeURIComponent(`Invoice ${quote.ref}, ${quote.title}`)}&body=${encoded}`;

  return (
    <AppShell>
      <div className="bg-ink text-paper px-5 pt-6 pb-5 flex items-center gap-3">
        <BusinessLogo logoUrl={userProfile.logo_url} businessName={userProfile.business_name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-paper truncate">{userProfile.business_name}</p>
          <p className="text-[10px] text-paper/60 truncate">{userProfile.registration_number} · VAT {userProfile.vat_number}</p>
        </div>
        <QuottrLogo className="h-5 w-auto opacity-60" />
      </div>
      <PageHeader title={quote.title} subtitle={quote.ref} back="/quotes" right={<StatusBadge status={status === "paid" ? "paid" : invoicedAt ? "invoiced" : status} />} />

      {portalStatus && (portalStatus.expired || portalStatus.days_remaining <= 7) && (
        <section className="px-5 mt-3">
          <div className="rounded-2xl border border-amber-500/40 bg-amber-50 text-amber-900 p-3 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">
                {portalStatus.expired
                  ? "This link has expired."
                  : `This link expires in ${portalStatus.days_remaining} day${portalStatus.days_remaining === 1 ? "" : "s"}.`}
              </p>
              <button
                type="button"
                onClick={handleRegenerateAndResend}
                disabled={regenerating}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-ink text-paper text-xs font-semibold px-3 py-1.5 disabled:opacity-60"
              >
                {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Regenerate and resend
              </button>
            </div>
          </div>
        </section>
      )}


      {status === "declined" && (
        <section className="px-5 mt-3">
          <div className="card-surface p-3 text-center text-sm text-muted-foreground">
            Customer declined this quote. <button onClick={async () => { try { await setQuoteStatus(quote.id, "pending"); setStatusState("pending"); } catch (e) { feedback("error"); toast.error(e instanceof Error ? e.message : "Could not reopen"); } }} className="underline font-semibold text-ink ml-1">Reopen</button>
          </div>
        </section>
      )}

      {client && (
        <section className="px-5">
          <Link to="/clients/$clientId" params={{ clientId: client.id }} className="card-surface p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-lime/30 flex items-center justify-center text-ink font-bold">
              {client.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{client.name}</p>
              <p className="text-xs text-muted-foreground truncate">{client.address}</p>
            </div>
          </Link>
        </section>
      )}

      {status === "pending" && (
        <section className="px-5 mt-3">
          <button
            onClick={() => (client ? setSendOpen(true) : setAssignOpen(true))}
            className="w-full bg-lime text-ink rounded-full py-4 font-bold inline-flex items-center justify-center gap-2 text-base shadow-[0_8px_24px_-8px_rgba(200,224,74,0.6)] active:scale-[0.99] transition"
          >
            <Send className="h-4 w-4" />
            {client ? `Send to ${client.name.split(" ")[0]}` : "Add client to send"}
          </button>
        </section>
      )}

      {userProfile.quote_intro && (
        <section className="px-5 mt-4">
          <div className="card-surface p-5">
            <p className="text-sm leading-relaxed italic text-muted-foreground">{userProfile.quote_intro}</p>
          </div>
        </section>
      )}

      <section className="px-5 mt-4">
        <div className="card-surface p-5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Job description</p>
          <p className="text-sm mt-2 leading-relaxed">{quote.job_description}</p>
        </div>
      </section>

      <section className="px-5 mt-4">
        <div className="card-surface overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Itemised</p>
          </div>
          <LineItemsEditor
            quote={quote}
            vatRegistered={userProfile.vat_registered}
            onChange={(items) => {
              quote.line_items = items;
            }}
          />
        </div>
      </section>

      {(userProfile.quote_footer || (userProfile.show_signature && (userProfile.signature_name || userProfile.full_name))) && (
        <section className="px-5 mt-3">
          <div className="px-1 space-y-2">
            {userProfile.quote_footer && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">{userProfile.quote_footer}</p>
            )}
            {userProfile.show_signature && (userProfile.signature_name || userProfile.full_name) && (
              <p className="text-[11px] text-muted-foreground">
                Signed{" "}
                <span className="text-sm text-ink" style={{ fontFamily: "'Caveat', 'Bradley Hand', cursive" }}>
                  {userProfile.signature_name || userProfile.full_name}
                </span>
                {" · "}{userProfile.business_name}
              </p>
            )}
          </div>
        </section>
      )}


      {/* Payment method selector */}
      <section className="px-5 mt-5">
        <h2 className="text-xl mb-2.5">Payment method</h2>
        <div className="card-surface p-2 space-y-1.5">
          <MethodOption
            active={method === "card"} onClick={() => setMethod("card")}
            icon={CreditCard} label="Pay by card online"
            sub={userProfile.stripe_connected ? "Stripe link auto-included" : "Stripe (test link), connect Stripe in Settings to go live"}
          />
          <MethodOption
            active={method === "bank"} onClick={() => setMethod("bank")}
            icon={Landmark} label="Pay by bank transfer"
            sub={`${userProfile.bank_name} · sort ${userProfile.sort_code}`}
          />
          <MethodOption
            active={method === "cash"} onClick={() => setMethod("cash")}
            icon={Banknote} label="Cash on completion"
            sub="Customer brings cash on the day"
          />
        </div>

        {method === "card" && (
          <div className="mt-3">
            <a
              href={paymentRequest ? paymentRequest.link : stripePaymentLink(liveQuote)}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-ink text-paper rounded-full py-3.5 font-bold inline-flex items-center justify-center gap-2 text-sm"
            >
              <CreditCard className="h-4 w-4" /> Pay by card
              {paymentRequest && <span className="num text-paper/80">· {formatGBP(paymentRequest.amount)}</span>}
            </a>
            {!userProfile.stripe_connected && (
              <p className="text-[10px] text-muted-foreground mt-2 text-center">Test link, add your Stripe keys in Settings to go live.</p>
            )}
          </div>
        )}
        {method === "bank" && (
          <div className="mt-3 card-surface p-4 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Bank details</p>
            <BankRow k="Account name" v={userProfile.bank_account_name} />
            <BankRow k="Sort code" v={userProfile.sort_code} />
            <BankRow k="Account no." v={userProfile.account_number} />
            <BankRow k="Reference" v={quote.ref} />
          </div>
        )}
        {method === "cash" && (
          <div className="mt-3 card-surface p-4">
            <p className="text-sm"><span className="font-semibold">Cash on completion</span>, please have cash ready on the day.</p>
          </div>
        )}
      </section>

      {/* Spacer so content isn't hidden behind sticky bar */}
      <div className="h-36" aria-hidden />

      {/* Sticky bottom action bar — Send · Mark Paid · Chase always visible */}
      <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
        <div className="mx-auto max-w-md px-4 pb-4 pt-3 pointer-events-auto bg-gradient-to-t from-paper via-paper to-paper/0">
          <div className="card-surface bg-paper shadow-lg p-2.5 flex items-center gap-2">
            <button
              onClick={primary.onClick}
              className="flex-1 bg-lime text-ink rounded-full py-3 font-bold inline-flex items-center justify-center gap-2 text-sm"
            >
              <PrimaryIcon className="h-4 w-4" />
              {primary.label}
            </button>
            {status !== "paid" && (
              <button
                onClick={() => setAskingPaid(true)}
                aria-label="Mark as paid"
                className="h-12 w-12 rounded-full bg-ink text-paper inline-flex items-center justify-center shrink-0"
              >
                <CheckCircle2 className="h-5 w-5" />
              </button>
            )}
            {(status === "sent" || status === "accepted" || invoicedAt) && status !== "paid" && client?.phone && (
              <button
                onClick={() => {
                  const first = client.name.split(" ")[0] ?? "there";
                  const msg = `Hi ${first}, just following up on ${quote.ref} for ${formatGBP(quote.total)}. Could you let me know when payment will be made? Thanks.`;
                  const digits = client.phone.replace(/\D/g, "");
                  window.open(`https://wa.me/${digits ? "44" + digits.replace(/^0/, "") : ""}?text=${encodeURIComponent(msg)}`, "_blank");
                }}
                aria-label="Send chaser"
                className="h-12 w-12 rounded-full bg-secondary text-ink inline-flex items-center justify-center shrink-0"
              >
                <MessageCircle className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={() => setMoreOpen(true)}
              aria-label="More options"
              className="h-12 w-12 rounded-full bg-secondary text-ink inline-flex items-center justify-center shrink-0 font-bold"
            >
              ⋯
            </button>
          </div>
          {(status === "accepted" || status === "sent") && (
            <button
              onClick={() => takePaymentOnSite("full")}
              disabled={takingOnSite}
              className="w-full mt-2 bg-ink/90 text-paper rounded-full py-2.5 font-semibold inline-flex items-center justify-center gap-2 text-xs disabled:opacity-60"
            >
              {takingOnSite ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Nfc className="h-3.5 w-3.5" />}
              Take payment on site · {formatGBP(quote.total)}
            </button>
          )}
          {status === "paid" && (
            <div className="w-full mt-2 bg-status-paid/15 border border-status-paid/40 rounded-full py-2 px-4 inline-flex items-center justify-center gap-2 text-xs font-semibold text-ink">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Paid via {paidVia === "card" ? "card" : paidVia === "bank" ? "bank transfer" : "cash"}
            </div>
          )}
        </div>
      </div>

      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/60" onClick={() => setMoreOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-paper rounded-t-3xl p-2 pb-6" onClick={(e) => e.stopPropagation()}>
            <div className="h-1 w-10 bg-ink/20 rounded-full mx-auto my-3" />
            <h3 className="text-xl px-4 mb-2">More options</h3>
            <ul className="px-2">
              <MoreItem icon={Mail} label="Email customer" onClick={() => { setMoreOpen(false); window.location.href = mailHref; }} />
              <MoreItem icon={Phone} label="Call customer" onClick={() => { setMoreOpen(false); window.location.href = `tel:${client?.phone}`; }} />
              <MoreItem icon={Share2} label="Share PDF" onClick={() => { setMoreOpen(false); sharePdf(); }} />
              <MoreItem icon={Copy} label="Duplicate quote" onClick={() => { setMoreOpen(false); duplicate(); }} />
              {status === "pending" && (
                <MoreItem icon={Send} label="Mark as sent" onClick={() => { setMoreOpen(false); markSent(); }} />
              )}
              {status === "accepted" && (
                <MoreItem icon={Zap} label="Request payment (send link)" onClick={() => { setMoreOpen(false); setRequesting(true); }} />
              )}
              {(status === "accepted" || status === "sent") && (
                <MoreItem icon={Smartphone} label="Take 50% deposit on site" onClick={() => { setMoreOpen(false); takePaymentOnSite("deposit"); }} />
              )}
              {invoicedAt && (
                <MoreItem icon={FileText} label="View final invoice" onClick={() => { setMoreOpen(false); navigate({ to: "/invoices/$quoteId", params: { quoteId: quote.id } }); }} />
              )}
              {status !== "declined" && status !== "paid" && (
                <MoreItem icon={XCircle} label="Mark as declined" onClick={() => { setMoreOpen(false); declineQuote(); }} danger />
              )}
            </ul>
          </div>
        </div>
      )}

      <SendQuoteDialog
        open={sendOpen}
        onClose={() => { setSendOpen(false); setUpdatedLinkCode(undefined); }}
        quoteId={quote.id}
        quoteRef={quote.ref ?? quote.id.slice(0, 8)}
        quoteTitle={quote.title}
        customerName={client?.name}
        customerPhone={client?.phone}
        customerEmail={client?.email}
        whatsappHref={waHref}
        updatedLinkPortalCode={updatedLinkCode}
      />

      <AssignClientDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        quoteId={quote.id}
        onAssigned={() => setSendOpen(true)}
      />

      {/* Bottom sheet: how did the customer pay? */}
      {askingPaid && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/60" onClick={() => setAskingPaid(false)}>
          <div className="w-full bg-paper rounded-t-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="h-1 w-10 bg-ink/20 rounded-full mx-auto mb-4" />
            <h3 className="text-2xl">How did the customer pay?</h3>
            <p className="text-xs text-muted-foreground mb-4">This marks the invoice as paid and logs it in your profit tracker.</p>
            <div className="space-y-2">
              <PaidButton icon={CreditCard} label="Card" onClick={() => markPaid("card")} />
              <PaidButton icon={Landmark} label="Bank transfer" onClick={() => markPaid("bank")} />
              <PaidButton icon={Banknote} label="Cash" onClick={() => markPaid("cash")} />
            </div>
            <button onClick={() => setAskingPaid(false)} className="w-full mt-3 text-sm text-muted-foreground py-2">Cancel</button>
          </div>
        </div>
      )}

      {/* Bottom sheet: request payment via Stripe */}
      {requesting && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/60" onClick={() => setRequesting(false)}>
          <div className="w-full bg-paper rounded-t-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="h-1 w-10 bg-ink/20 rounded-full mx-auto mb-4" />
            <h3 className="text-2xl">Request payment</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Generates a real Stripe Checkout link and adds it to the WhatsApp & email message.
            </p>
            {error && (
              <p className="text-xs text-status-overdue bg-status-overdue/10 rounded-xl px-3 py-2 mb-3">{error}</p>
            )}
            <fieldset disabled={creating} className="space-y-2 disabled:opacity-60">
              <RequestOption
                label="Deposit (50%)"
                amount={formatGBP(quote.total * 0.5)}
                onClick={() => createPaymentRequest("deposit")}
              />
              <RequestOption
                label="Full payment"
                amount={formatGBP(quote.total)}
                onClick={() => createPaymentRequest("full")}
              />
              <div className="bg-ink text-paper rounded-2xl p-4">
                <p className="text-[10px] uppercase tracking-widest text-paper/60 font-semibold mb-2">Custom amount</p>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center bg-paper/10 rounded-2xl px-4">
                    <span className="text-lime font-bold mr-1">£</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={customAmt}
                      onChange={(e) => setCustomAmt(e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 bg-transparent py-3 text-sm text-paper placeholder:text-paper/40 outline-none"
                    />
                  </div>
                  <button
                    disabled={!customAmt || Number(customAmt) <= 0 || creating}
                    onClick={() => createPaymentRequest("custom", Number(customAmt))}
                    className="bg-lime text-ink rounded-full px-5 font-bold text-sm disabled:opacity-40"
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                  </button>
                </div>
              </div>
            </fieldset>
            <button onClick={() => setRequesting(false)} className="w-full mt-3 text-sm text-muted-foreground py-2">
              {creating ? "Working…" : "Cancel"}
            </button>
          </div>
        </div>
      )}


      {/* Bottom sheet: deposit on acceptance */}
      {askDeposit && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/60" onClick={() => setAskDeposit(false)}>
          <div className="w-full max-w-md mx-auto bg-paper rounded-t-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="h-1 w-10 bg-ink/20 rounded-full mx-auto mb-4" />
            <h3 className="text-2xl">Quote accepted 🎉</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Request 50% deposit now? We'll send {client?.name.split(" ")[0] ?? "the customer"} a WhatsApp with the payment options.
            </p>
            <div className="mt-4 rounded-2xl bg-ink text-paper p-4 flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-widest text-paper/60 font-semibold">Deposit (50%)</span>
              <span className="num text-3xl text-lime">{formatGBP(quote.total * 0.5)}</span>
            </div>
            <button
              onClick={sendDepositRequest}
              className="w-full mt-4 bg-lime text-ink rounded-full py-3.5 font-bold text-sm inline-flex items-center justify-center gap-2"
            >
              <MessageCircle className="h-4 w-4" /> Yes, send deposit request
            </button>
            <button onClick={() => setAskDeposit(false)} className="w-full mt-2 text-sm text-muted-foreground py-2">
              No, skip for now
            </button>
          </div>
        </div>
      )}

      {/* Bottom sheet: send final invoice */}
      {askInvoice && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/60" onClick={() => setAskInvoice(false)}>
          <div className="w-full max-w-md mx-auto bg-paper rounded-t-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="h-1 w-10 bg-ink/20 rounded-full mx-auto mb-4" />
            <h3 className="text-2xl">Ready to send final invoice?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              We'll generate a clean INVOICE document with the bank details and payment link at the top, and set a 14-day payment due date.
            </p>
            <button
              onClick={issueInvoice}
              className="w-full mt-4 bg-lime text-ink rounded-full py-3.5 font-bold text-sm inline-flex items-center justify-center gap-2"
            >
              <FileText className="h-4 w-4" /> Generate invoice
            </button>
            <button onClick={() => setAskInvoice(false)} className="w-full mt-2 text-sm text-muted-foreground py-2">
              Not yet
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function RequestOption({ label, amount, onClick }: { label: string; amount: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-ink text-paper rounded-2xl py-4 px-5 flex items-center justify-between"
    >
      <span className="font-bold text-sm">{label}</span>
      <span className="num text-2xl text-lime">{amount}</span>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}

function BankRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold num">{v}</span>
    </div>
  );
}

function MethodOption({
  active, onClick, icon: Icon, label, sub,
}: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl p-3.5 flex items-center gap-3 transition ${active ? "bg-lime text-ink" : "bg-transparent hover:bg-secondary"}`}
    >
      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${active ? "bg-ink text-lime" : "bg-secondary text-ink"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">{label}</p>
        <p className={`text-[11px] truncate ${active ? "text-ink/70" : "text-muted-foreground"}`}>{sub}</p>
      </div>
      {active && <Check className="h-4 w-4 shrink-0" />}
    </button>
  );
}

function PaidButton({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full bg-ink text-paper rounded-2xl py-4 font-bold inline-flex items-center justify-center gap-2">
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function MoreItem({
  icon: Icon, label, onClick, danger,
}: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-secondary text-left ${danger ? "text-status-overdue" : "text-ink"}`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="text-sm font-semibold">{label}</span>
      </button>
    </li>
  );
}

function badgeClass(source: LineItem["source"]) {
  if (source === "voice") return "bg-lime/30 text-ink";
  if (source === "learned") return "bg-lime/15 text-ink";
  return "bg-secondary text-muted-foreground";
}
function badgeText(source: LineItem["source"]) {
  if (source === "voice") return "Your price";
  if (source === "learned") return "Your usual price";
  if (source === "ai") return "Quottr suggested";
  return null;
}

function LineItemsEditor({
  quote,
  vatRegistered,
  onChange,
}: {
  quote: Quote;
  vatRegistered: boolean;
  onChange?: (items: LineItem[]) => void;
}) {
  const [items, setItems] = useState<LineItem[]>(quote.line_items.map((li) => ({ ...li })));
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draftPrice, setDraftPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const paidQuoteCount = usePaidQuoteCount();

  const subtotal = +items.reduce((s, li) => s + li.qty * li.unit_price, 0).toFixed(2);
  const vat = vatRegistered ? +(subtotal * 0.2).toFixed(2) : 0;
  const total = +(subtotal + vat).toFixed(2);

  const beginEdit = (i: number) => {
    setEditingIdx(i);
    setDraftPrice(String(items[i].unit_price));
  };
  const commitEdit = async () => {
    if (editingIdx === null) return;
    const parsed = Number(draftPrice);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setEditingIdx(null);
      return;
    }
    const next = items.map((li, idx) =>
      idx === editingIdx ? { ...li, unit_price: +parsed.toFixed(2), source: "voice" as const } : li,
    );
    setItems(next);
    setEditingIdx(null);
    onChange?.(next);
    setSaving(true);
    try {
      await updateQuoteLineItems(quote.id, next, vatRegistered);
      feedback("success");
    } catch (e) {
      console.error(e);
      feedback("error");
      toast.error(e instanceof Error ? e.message : "Could not save price");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ul>
        {items.map((li, i) => {
          const effectiveSource = normalizeSource(li.source, paidQuoteCount);
          const label = badgeText(effectiveSource);
          const editing = editingIdx === i;
          return (
            <li
              key={i}
              className="px-5 py-3 flex items-start gap-3 border-t border-border first:border-t-0"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{li.description}</p>
                  {label && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeClass(effectiveSource)}`}
                    >
                      {label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {li.qty} × {formatGBP(li.unit_price)}
                </p>
              </div>
              {editing ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">£</span>
                  <input
                    autoFocus
                    type="text"
                    inputMode="decimal"
                    step="0.01"
                    value={draftPrice}
                    onChange={(e) => setDraftPrice(e.target.value)}
                    onBlur={commitEdit}
                    onFocus={(e) => e.currentTarget.select()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingIdx(null);
                    }}
                    className="w-20 text-right bg-paper border border-border rounded-md px-2 py-1 text-sm num outline-none focus:border-ink"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => beginEdit(i)}
                  className="num text-base text-ink hover:underline focus:outline-none"
                  aria-label="Edit price"
                >
                  {formatGBP(li.qty * li.unit_price)}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="px-5 py-4 border-t border-border bg-secondary/40 space-y-1.5">
        <Row label="Subtotal" value={formatGBP(subtotal)} />
        {vatRegistered && <Row label="VAT (20%)" value={formatGBP(vat)} />}
        <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-border">
          <span className="text-sm uppercase tracking-widest font-semibold">Total</span>
          <span className="num text-3xl text-ink">{formatGBP(total)}</span>
        </div>
        {saving && (
          <p className="text-[10px] text-muted-foreground pt-1">Saving…</p>
        )}
      </div>
    </>
  );
}

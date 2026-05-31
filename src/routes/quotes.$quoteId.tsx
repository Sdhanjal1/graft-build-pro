import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import {
  getQuote, getClient, userProfile, formatGBP, waLink,
  buildInvoiceMessage, stripePaymentLink, buildPaymentRequest,
  duplicateQuote, buildDepositOnAcceptMessage, markInvoiced, ensureChasesFor,
  setQuoteStatus, updateQuoteLineItems, markJobComplete, updateQuotePaymentTiming,
  deleteQuote,
  materialsForQuote,
  type PaymentMethod, type PaymentRequest, type PaymentRequestType, type Quote, type LineItem, type LineItemCategory,
} from "@/lib/user-data";
import { createInvoiceCheckout, recordManualDeposit, removeManualDeposit, getQuotePaymentStatus } from "@/lib/payments.functions";
import { getPortalLinkStatusForQuote, regeneratePortalCode } from "@/lib/portal.functions";
import { MessageCircle, Mail, Phone, CreditCard, Landmark, Banknote, Check, CheckCircle2, Zap, Loader2, ThumbsUp, Copy, FileText, Share2, Send, XCircle, MessageSquare, Smartphone, Nfc, AlertTriangle, Clock, Sparkles, Eye, Trash2, Pencil, Plus, ShoppingCart, ChevronDown, RotateCcw, Undo2 } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MaterialListSheet } from "@/components/MaterialListSheet";
import { suggestPriceForDescription } from "@/lib/pricing-patterns.functions";
import {
  computeDepositAmount, computeDepositPercent, parseDepositInput,
  paymentTimingLabel, defaultDepositPercent,
  type PaymentTiming,
} from "@/lib/payment-timing";
import { QuottrLogo } from "@/components/QuottrLogo";
import { BusinessLogo } from "@/components/BusinessLogo";
import { downloadOrShareQuotePdf } from "@/lib/pdf";
import { toast } from "sonner";
import { feedback, playSample } from "@/lib/feedback";
import { SendQuoteDialog } from "@/components/SendQuoteDialog";
import { AssignClientDialog } from "@/components/AssignClientDialog";
import { listQuoteMessages, sendProMessage } from "@/lib/messages.functions";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef } from "react";
import { usePaidQuoteCount, useInvalidatePaidQuoteCount, normalizeSource } from "@/hooks/usePaidQuoteCount";

function celebratePaid(amount: number) {
  if (typeof window === "undefined") return;
  playSample("cash");
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
  const [askDeposit, setAskDeposit] = useState(false);
  const [askInvoice, setAskInvoice] = useState(false);
  const [invoicedAt, setInvoicedAt] = useState<string | undefined>(quote.invoiced_at);
  const [sendOpen, setSendOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  
  const [timingOpen, setTimingOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const materialsCount = materialsForQuote(quote).length;
  const showMaterialsCta = (status === "accepted") && materialsCount > 0;

  // Payment timing state
  const initialTiming: PaymentTiming = quote.payment_timing ?? "on_completion";
  const initialPct = quote.deposit_percent ?? (initialTiming === "deposit_then_balance" ? defaultDepositPercent(userProfile.default_deposit_percent) : 0);
  const initialAmt = quote.deposit_amount ?? (initialTiming === "deposit_then_balance" ? computeDepositAmount(quote.subtotal, initialPct) : 0);
  const [timing, setTimingState] = useState<PaymentTiming>(initialTiming);
  const [depositPct, setDepositPct] = useState<number>(initialPct);
  const [depositAmt, setDepositAmt] = useState<number>(initialAmt);
  const [depositAmtRaw, setDepositAmtRaw] = useState<string>(initialAmt ? String(initialAmt) : "");
  const [depositPctRaw, setDepositPctRaw] = useState<string>(initialPct ? String(initialPct) : "");

  const [portalStatus, setPortalStatus] = useState<{
    client_id: string;
    portal_code: string | null;
    days_remaining: number;
    expired: boolean;
  } | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [updatedLinkCode, setUpdatedLinkCode] = useState<string | undefined>(undefined);
  const invalidatePaidQuoteCount = useInvalidatePaidQuoteCount();
  const navigate = useNavigate();
  // (schedule defaults removed)

  const createCheckout = useServerFn(createInvoiceCheckout);
  const fetchPortalStatus = useServerFn(getPortalLinkStatusForQuote);
  const regeneratePortalCodeFn = useServerFn(regeneratePortalCode);
  const recordDepositFn = useServerFn(recordManualDeposit);
  const removeDepositFn = useServerFn(removeManualDeposit);
  const fetchPaymentsFn = useServerFn(getQuotePaymentStatus);
  const [recordingDeposit, setRecordingDeposit] = useState(false);
  const [recordDepositOpen, setRecordDepositOpen] = useState(false);
  const [depositRecorded, setDepositRecorded] = useState(false);
  const [depositPaid, setDepositPaid] = useState(0);

  // Real configured deposit for this quote (not a hardcoded 50%).
  const configuredDeposit = (() => {
    const total = Number(quote.total) || 0;
    const explicit = Number(quote.deposit_amount) || 0;
    const pct = Number(quote.deposit_percent) || 0;
    if (explicit > 0) return explicit;
    if (pct > 0) return +(total * (pct / 100)).toFixed(2);
    return 0;
  })();
  const configuredDepositPct = (() => {
    const total = Number(quote.total) || 0;
    if (total <= 0 || configuredDeposit <= 0) return 0;
    return Math.round((configuredDeposit / total) * 100);
  })();

  const handleRecordManualDeposit = async (method: "cash" | "bank") => {
    if (recordingDeposit || depositRecorded) return;
    setRecordingDeposit(true);
    try {
      const res = await recordDepositFn({ data: { quoteId: quote.id, method } });
      feedback("success");
      setDepositRecorded(true);
      toast.success(
        (res as { alreadyRecorded?: boolean })?.alreadyRecorded
          ? "Deposit already recorded"
          : "Deposit recorded",
      );
      // Brief delay so the user sees the success state before the sheet closes.
      setTimeout(() => {
        setAskDeposit(false);
        setRecordDepositOpen(false);
      }, 800);
    } catch (e) {
      feedback("error");
      toast.error(e instanceof Error ? e.message : "Could not record deposit");
    } finally {
      setRecordingDeposit(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchPaymentsFn({ data: { quoteId: quote.id } })
      .then((res) => {
        if (cancelled) return;
        const rows = res?.payments ?? [];
        const paid = rows
          .filter((r) => r.status === "paid" && r.request_type === "deposit")
          .reduce((sum, r) => sum + (Number(r.amount_cents) || 0), 0) / 100;
        setDepositPaid(paid);
        if (paid > 0) setDepositRecorded(true);
      })
      .catch(() => { /* non-blocking */ });
    return () => { cancelled = true; };
  }, [quote.id, fetchPaymentsFn]);

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

  // First-quote celebration toast (shows once per user, set by quotes.new).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const celebrateId = sessionStorage.getItem("quottr.celebrateFirstQuote");
      if (celebrateId && celebrateId === quote.id) {
        sessionStorage.removeItem("quottr.celebrateFirstQuote");
        const who = client?.name?.split(" ")[0] ?? "your customer";
        toast.success(`Your first Quottr quote. Tap Send to share it with ${who}.`);
      }
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote.id]);

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
  const removeRecordedDeposit = async () => {
    if (!window.confirm("Remove the recorded deposit? The balance will go back to the full amount.")) return;
    try {
      await removeDepositFn({ data: { quoteId: quote.id } });
      setDepositPaid(0);
      setDepositRecorded(false);
      feedback("success"); toast.success("Deposit removed");
    } catch (e) {
      feedback("error"); toast.error(e instanceof Error ? e.message : "Could not remove deposit");
    }
  };
  const markUnpaid = async () => {
    if (!window.confirm("Mark this quote as unpaid? It will go back to awaiting payment.")) return;
    try {
      await setQuoteStatus(quote.id, "completed");
      setStatusState("completed");
      feedback("success"); toast.success("Marked as unpaid");
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
    invalidatePaidQuoteCount();
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
  const removeQuote = async () => {
    if (typeof window !== "undefined" && !window.confirm("Delete this quote? This cannot be undone.")) return;
    try {
      await deleteQuote(quote.id);
      feedback("success"); toast.success("Quote deleted");
      navigate({ to: "/quotes" });
    } catch (e) {
      feedback("error"); toast.error(e instanceof Error ? e.message : "Could not delete quote");
    }
  };
  const viewAsCustomer = () => {
    if (portalStatus?.portal_code) {
      navigate({ to: "/portal/c/$code", params: { code: portalStatus.portal_code } });
    } else {
      navigate({ to: "/portal/$token", params: { token: quote.id } });
    }
  };


  const sendDepositRequest = () => {
    const firstName = client?.name.split(" ")[0] ?? "there";
    const { message } = buildDepositOnAcceptMessage(quote, firstName);
    const wa = waLink(client?.phone, message);
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
  // Mark job physically complete (separate from marking paid).
  const completeJob = async () => {
    try {
      await markJobComplete(quote.id);
      setStatusState("completed");
      feedback("success");
      toast.success("Job marked complete — ready to take payment");
    } catch (e) {
      feedback("error"); toast.error(e instanceof Error ? e.message : "Could not update status");
    }
  };

  // Debounced save of payment timing / deposit changes.
  const timingSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistTiming = (patch: { payment_timing?: PaymentTiming; deposit_amount?: number; deposit_percent?: number }) => {
    if (timingSaveTimer.current) clearTimeout(timingSaveTimer.current);
    timingSaveTimer.current = setTimeout(() => {
      updateQuotePaymentTiming(quote.id, patch).catch((e) => {
        console.warn("[payment-timing] save failed", e);
      });
    }, 500);
  };
  const onTimingChange = (next: PaymentTiming) => {
    setTimingState(next);
    if (next === "deposit_then_balance") {
      const pct = depositPct || defaultDepositPercent(userProfile.default_deposit_percent);
      const amt = computeDepositAmount(quote.subtotal, pct);
      setDepositPct(pct); setDepositAmt(amt);
      setDepositPctRaw(String(pct)); setDepositAmtRaw(String(amt));
      persistTiming({ payment_timing: next, deposit_amount: amt, deposit_percent: pct });
    } else {
      setDepositPct(0); setDepositAmt(0);
      setDepositAmtRaw(""); setDepositPctRaw("");
      persistTiming({ payment_timing: next, deposit_amount: 0, deposit_percent: 0 });
    }
  };
  const onDepositAmtBlur = () => {
    const parsed = parseDepositInput(depositAmtRaw);
    if (!parsed) return;
    const amt = parsed.kind === "amount" ? parsed.value : computeDepositAmount(quote.subtotal, parsed.value);
    const pct = computeDepositPercent(quote.subtotal, amt);
    setDepositAmt(amt); setDepositPct(pct);
    setDepositAmtRaw(String(amt)); setDepositPctRaw(String(pct));
    persistTiming({ deposit_amount: amt, deposit_percent: pct });
  };
  const onDepositPctBlur = () => {
    const parsed = parseDepositInput(depositPctRaw);
    if (!parsed) return;
    // In the percent field, a bare number means PERCENT (not pounds).
    const rawPct = parsed.value;
    const pct = Math.max(0, Math.min(100, rawPct));
    const amt = computeDepositAmount(quote.subtotal, pct);
    setDepositPct(pct); setDepositAmt(amt);
    setDepositPctRaw(String(pct)); setDepositAmtRaw(String(amt));
    persistTiming({ deposit_amount: amt, deposit_percent: pct });
  };

  let primary: { label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void };
  if (status === "pending" || status === "declined") {
    primary = client
      ? { label: `Send to ${client.name.split(" ")[0]}`, icon: Send, onClick: () => setSendOpen(true) }
      : { label: "Add client to send", icon: Send, onClick: () => setAssignOpen(true) };
  } else if (status === "sent") {
    primary = { label: "Mark as accepted", icon: ThumbsUp, onClick: acceptQuote };
  } else if (status === "accepted") {
    primary = { label: "Mark job complete", icon: Check, onClick: completeJob };
  } else if (status === "completed") {
    primary = { label: "Mark as paid", icon: CheckCircle2, onClick: () => setAskingPaid(true) };
  } else {
    primary = { label: "Share PDF", icon: Share2, onClick: sharePdf };
  }
  const PrimaryIcon = primary.icon;
  const messageBody = buildInvoiceMessage(liveQuote, client?.name.split(" ")[0] ?? "there");
  const waHref = waLink(client?.phone, messageBody);
  const mailHref = `mailto:${client?.email}?subject=${encodeURIComponent(`Invoice ${quote.ref}, ${quote.title}`)}&body=${encodeURIComponent(messageBody)}`;

  return (
    <AppShell>
      <div className="bg-ink text-paper px-5 pt-6 pb-5 flex items-center gap-3">
        <BusinessLogo logoUrl={userProfile.logo_url} businessName={userProfile.business_name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-paper truncate">{userProfile.business_name}</p>
          <p className="text-[10px] text-paper/60 truncate">
            {[
              userProfile.registration_number,
              userProfile.vat_registered && userProfile.vat_number ? `VAT ${userProfile.vat_number}` : null,
            ].filter(Boolean).join(" · ")}
          </p>
        </div>
        <QuottrLogo className="h-5 w-auto opacity-60" />
      </div>
      <PageHeader title={quote.title} subtitle={quote.ref} back="/quotes" right={<StatusBadge status={status === "paid" ? "paid" : invoicedAt ? "invoiced" : status} />} />

      {status === "declined" && (
        <section className="px-5 mt-5">
          <div className="card-surface p-3 text-center text-sm text-muted-foreground">
            Customer declined this quote. <button onClick={async () => { try { await setQuoteStatus(quote.id, "pending"); setStatusState("pending"); } catch (e) { feedback("error"); toast.error(e instanceof Error ? e.message : "Could not reopen"); } }} className="underline font-semibold text-ink ml-1">Reopen</button>
          </div>
        </section>
      )}

      {client && (
        <section className="px-5 mt-5">
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






      {userProfile.quote_intro && (
        <section className="px-5 mt-5">
          <div className="card-surface p-5">
            <p className="text-sm leading-relaxed italic text-muted-foreground">{userProfile.quote_intro}</p>
          </div>
        </section>
      )}

      <section className="px-5 mt-5">
        <div className="card-surface p-5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Job description</p>
          <p className="text-sm mt-2 leading-relaxed">{quote.job_description}</p>
        </div>
      </section>

      <section className="px-5 mt-5">
        <div className="card-surface overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Itemised</p>
          </div>
          <LineItemsEditor
            quote={quote}
            vatRegistered={userProfile.vat_registered}
            depositPaid={status !== "paid" ? depositPaid : 0}
            onChange={(items) => {
              quote.line_items = items;
            }}
          />

        </div>
      </section>

      {(userProfile.quote_footer || (userProfile.show_signature && (userProfile.signature_name || userProfile.full_name))) && (
        <section className="px-5 mt-5">
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

      {/* Options: secondary controls + actions, collapsed by default */}
      <section className="px-5 mt-5">
        <Accordion type="single" collapsible className="card-surface px-4">
          <AccordionItem value="options" className="border-b-0">
            <AccordionTrigger className="text-sm font-semibold text-ink hover:no-underline">
              Options
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1">
              {/* Payment terms */}
              <div className="rounded-2xl border-2 border-lime bg-lime/10 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-0.5">Payment terms</p>
                  <p className="text-sm font-bold text-ink leading-tight">
                    {paymentTimingLabel({ timing, total: quote.total, depositAmount: depositAmt, depositPercent: depositPct })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTimingOpen(true)}
                  className="shrink-0 text-xs font-semibold text-ink underline underline-offset-2"
                >
                  Change
                </button>
              </div>

              {/* Portal link status warning */}
              {portalStatus && (portalStatus.expired || portalStatus.days_remaining <= 7) && (
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
              )}

              {/* Paid status */}
              {status === "paid" && (
                <div className="rounded-2xl bg-status-paid/15 border border-status-paid/40 py-2 px-4 inline-flex items-center justify-center gap-2 text-xs font-semibold text-ink w-full">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Paid via {paidVia === "card" ? "card" : paidVia === "bank" ? "bank transfer" : "cash"}
                </div>
              )}

              {/* Material list */}
              {showMaterialsCta && (
                <button
                  onClick={() => setMaterialsOpen(true)}
                  className="w-full bg-ink text-paper rounded-full py-2.5 px-4 inline-flex items-center justify-center gap-2 text-xs font-bold"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Material list ({materialsCount})
                </button>
              )}

              {/* Action shortcuts */}
              <ul className="pt-1">
                <MoreItem icon={Eye} label="View as customer" onClick={viewAsCustomer} />
                {materialsCount > 0 && (
                  <MoreItem icon={ShoppingCart} label={`Material list (${materialsCount})`} onClick={() => setMaterialsOpen(true)} />
                )}
                <MoreItem icon={Share2} label="Download PDF" onClick={sharePdf} />
                <MoreItem icon={Copy} label="Duplicate quote" onClick={duplicate} />
                {status !== "paid" && (
                  <MoreItem icon={CheckCircle2} label="Mark as paid" onClick={() => setAskingPaid(true)} />
                )}
                {status !== "paid" && timing === "deposit_then_balance" && configuredDeposit > 0 && (
                  <MoreItem
                    icon={Banknote}
                    label={`Record deposit received (${formatGBP(configuredDeposit)})`}
                    onClick={() => setRecordDepositOpen(true)}
                  />
                )}
                {status !== "paid" && depositPaid > 0 && (
                  <MoreItem icon={Undo2} label="Remove recorded deposit" onClick={removeRecordedDeposit} />
                )}
                {status === "paid" && (
                  <MoreItem icon={RotateCcw} label="Mark as unpaid" onClick={markUnpaid} />
                )}
                {(status === "sent" || status === "accepted" || invoicedAt) && status !== "paid" && client?.phone && (
                  <MoreItem icon={MessageCircle} label="Send chaser on WhatsApp" onClick={() => {
                    const first = client.name.split(" ")[0] ?? "there";
                    const msg = `Hi ${first}, just following up on ${quote.ref} for ${formatGBP(quote.total)}. Could you let me know when payment will be made? Thanks.`;
                    window.open(waLink(client.phone, msg), "_blank");
                  }} />
                )}
                <MoreItem icon={Mail} label="Email customer" onClick={() => { window.location.href = mailHref; }} />
                <MoreItem icon={Phone} label="Call customer" onClick={() => { window.location.href = `tel:${client?.phone}`; }} />
                {status === "pending" && (
                  <MoreItem icon={Send} label="Mark as sent" onClick={markSent} />
                )}
                {status === "accepted" && (
                  <MoreItem icon={Zap} label="Request payment (send link)" onClick={() => setRequesting(true)} />
                )}
                {(status === "accepted" || status === "sent") && (
                  <MoreItem icon={Smartphone} label="Take payment on site" onClick={() => takePaymentOnSite("full")} />
                )}
                {invoicedAt && (
                  <MoreItem icon={FileText} label="View final invoice" onClick={() => navigate({ to: "/invoices/$quoteId", params: { quoteId: quote.id } })} />
                )}
                {status !== "declined" && status !== "paid" && (
                  <MoreItem icon={XCircle} label="Mark as declined" onClick={declineQuote} />
                )}
                <MoreItem icon={Trash2} label="Delete quote" onClick={removeQuote} danger />
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>


      {/* Spacer so content isn't hidden behind sticky bar + bottom nav */}
      <div className="h-32" aria-hidden />

      {/* Sticky bottom action bar — single primary action */}
      <div className="fixed bottom-20 inset-x-0 z-40 pointer-events-none">
        <div className="mx-auto max-w-md px-4 pt-3 pointer-events-auto bg-gradient-to-t from-paper via-paper to-paper/0">
          <button
            onClick={primary.onClick}
            onPointerDown={() => feedback("tap")}
            className="w-full bg-lime text-ink rounded-full py-3.5 font-bold inline-flex items-center justify-center gap-2 text-sm shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)]"
          >
            <PrimaryIcon className="h-4 w-4" />
            {primary.label}
          </button>
        </div>
      </div>



      {/* Bottom sheet: payment timing */}
      {timingOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/60" onClick={() => setTimingOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-paper rounded-t-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="h-1 w-10 bg-ink/20 rounded-full mx-auto mb-4" />
            <h3 className="text-2xl">When you get paid</h3>
            <p className="text-xs text-muted-foreground mb-4">Choose how this customer pays you.</p>
            <div className="space-y-1.5">
              <MethodOption active={timing === "on_completion"} icon={Check} label="On completion"
                sub="Customer pays after work is done" onClick={() => { onTimingChange("on_completion"); setTimingOpen(false); }} />
              <MethodOption active={timing === "deposit_then_balance"} icon={Banknote} label="Deposit then balance"
                sub="Take a deposit up front, balance on completion" onClick={() => { onTimingChange("deposit_then_balance"); setTimingOpen(false); }} />
              <MethodOption active={timing === "upfront"} icon={Zap} label="Upfront"
                sub="Full payment before work starts" onClick={() => { onTimingChange("upfront"); setTimingOpen(false); }} />

            </div>

            {timing === "deposit_then_balance" && (
              <div className="mt-4 card-surface p-4 space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Deposit</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="flex items-center bg-secondary rounded-2xl px-3 py-2.5 gap-1.5">
                    <span className="text-ink/60 font-bold">£</span>
                    <input
                      type="text" inputMode="decimal"
                      value={depositAmtRaw}
                      onChange={(e) => setDepositAmtRaw(e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      onBlur={onDepositAmtBlur}
                      placeholder="0.00"
                      className="flex-1 min-w-0 bg-transparent text-sm font-semibold num outline-none"
                    />
                  </label>
                  <label className="flex items-center bg-secondary rounded-2xl px-3 py-2.5 gap-1.5">
                    <input
                      type="text" inputMode="decimal"
                      value={depositPctRaw}
                      onChange={(e) => setDepositPctRaw(e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      onBlur={onDepositPctBlur}
                      placeholder="0"
                      className="flex-1 min-w-0 bg-transparent text-sm font-semibold num outline-none text-right"
                    />
                    <span className="text-ink/60 font-bold">%</span>
                  </label>
                </div>
              </div>
            )}

            <button onClick={() => setTimingOpen(false)} className="w-full mt-4 text-sm text-muted-foreground py-2">Done</button>
          </div>
        </div>
      )}

      <SendQuoteDialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        quoteId={quote.id}
        quoteRef={quote.ref}
        quoteTitle={quote.title}
        customerName={client?.name}
        customerPhone={client?.phone}
        customerEmail={client?.email}
        onSent={() => { if (status === "pending") setStatusState("sent"); }}
        onUndo={() => { if (status === "sent") setStatusState("pending"); }}
      />

      <MaterialListSheet
        open={materialsOpen}
        onClose={() => setMaterialsOpen(false)}
        quote={quote}
        customerName={client?.name}
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
              {configuredDeposit > 0
                ? <>Request the deposit now? We'll send {client?.name.split(" ")[0] ?? "the customer"} a WhatsApp with the payment options — or record it if you've already taken it.</>
                : <>No deposit is configured on this quote. You can still send a payment request from the actions below.</>}
            </p>
            {configuredDeposit > 0 && (
              <div className="mt-4 rounded-2xl bg-ink text-paper p-4 flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-widest text-paper/60 font-semibold">
                  Deposit{configuredDepositPct ? ` (${configuredDepositPct}%)` : ""}
                </span>
                <span className="num text-3xl text-lime">{formatGBP(configuredDeposit)}</span>
              </div>
            )}
            <button
              onClick={sendDepositRequest}
              disabled={configuredDeposit <= 0}
              className="w-full mt-4 bg-lime text-ink rounded-full py-3.5 font-bold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <MessageCircle className="h-4 w-4" /> Yes, send deposit request
            </button>
            {configuredDeposit > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleRecordManualDeposit("cash")}
                  disabled={recordingDeposit || depositRecorded}
                  className="rounded-full border border-ink/15 py-3 font-semibold text-sm disabled:opacity-50"
                >
                  {depositRecorded ? "Recorded ✓" : recordingDeposit ? "Saving…" : "Cash received"}
                </button>
                <button
                  onClick={() => handleRecordManualDeposit("bank")}
                  disabled={recordingDeposit || depositRecorded}
                  className="rounded-full border border-ink/15 py-3 font-semibold text-sm disabled:opacity-50"
                >
                  {depositRecorded ? "Recorded ✓" : recordingDeposit ? "Saving…" : "Bank received"}
                </button>
              </div>
            )}
            <button onClick={() => setAskDeposit(false)} className="w-full mt-2 text-sm text-muted-foreground py-2">
              No, skip for now
            </button>
          </div>
        </div>
      )}

      {/* Bottom sheet: record deposit received (cash/bank) — available any time after acceptance */}
      <Sheet open={recordDepositOpen} onOpenChange={setRecordDepositOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-0 bg-paper p-0">
          <SheetHeader className="px-5 pt-5 pb-2 text-left">
            <SheetTitle className="text-base text-muted-foreground font-normal">
              Record deposit received · {formatGBP(configuredDeposit)}
            </SheetTitle>
          </SheetHeader>
          <div className="px-5 pb-6 pt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => handleRecordManualDeposit("cash")}
              disabled={recordingDeposit || depositRecorded}
              className="rounded-full border border-ink/15 py-3 font-semibold text-sm disabled:opacity-50"
            >
              {depositRecorded ? "Recorded ✓" : recordingDeposit ? "Saving…" : "Cash received"}
            </button>
            <button
              onClick={() => handleRecordManualDeposit("bank")}
              disabled={recordingDeposit || depositRecorded}
              className="rounded-full border border-ink/15 py-3 font-semibold text-sm disabled:opacity-50"
            >
              {depositRecorded ? "Recorded ✓" : recordingDeposit ? "Saving…" : "Bank received"}
            </button>
          </div>
        </SheetContent>
      </Sheet>


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
  depositPaid = 0,
  onChange,
}: {
  quote: Quote;
  vatRegistered: boolean;
  depositPaid?: number;
  onChange?: (items: LineItem[]) => void;
}) {

  const [items, setItems] = useState<LineItem[]>(quote.line_items.map((li) => ({ ...li })));
  // editingIdx: null = idle, -1 = adding new, >=0 = editing existing
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ description: string; qty: string; price: string; category: LineItemCategory } | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggestion, setSuggestion] = useState<{ typical_price: number; price_count: number } | null>(null);
  const paidQuoteCount = usePaidQuoteCount();
  const suggestFn = useServerFn(suggestPriceForDescription);
  const lastSuggestQuery = useRef<string>("");

  const isAdding = editingIdx === -1;

  // Debounced price suggestion while adding a new line
  useEffect(() => {
    if (!isAdding || !draft) { setSuggestion(null); return; }
    const q = draft.description.trim();
    if (q.length < 2) { setSuggestion(null); lastSuggestQuery.current = ""; return; }
    if (q === lastSuggestQuery.current) return;
    const handle = setTimeout(async () => {
      lastSuggestQuery.current = q;
      try {
        const res = await suggestFn({ data: { description: q } });
        setSuggestion(res ? { typical_price: res.typical_price, price_count: res.price_count } : null);
      } catch { setSuggestion(null); }
    }, 300);
    return () => clearTimeout(handle);
  }, [isAdding, draft, suggestFn]);

  const subtotal = +items.reduce((s, li) => s + li.qty * li.unit_price, 0).toFixed(2);
  const vat = vatRegistered ? +(subtotal * 0.2).toFixed(2) : 0;
  const total = +(subtotal + vat).toFixed(2);

  const beginEdit = (idx: number) => {
    const li = items[idx];
    setDraft({ description: li.description, qty: String(li.qty), price: String(li.unit_price), category: li.category ?? "other" });
    setEditingIdx(idx);
    setSuggestion(null);
  };

  const beginAdd = () => {
    setDraft({ description: "", qty: "1", price: "", category: "other" });
    setEditingIdx(-1);
    setSuggestion(null);
    lastSuggestQuery.current = "";
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setDraft(null);
    setSuggestion(null);
  };

  const persist = async (next: LineItem[]) => {
    setItems(next);
    onChange?.(next);
    setSaving(true);
    try {
      await updateQuoteLineItems(quote.id, next, vatRegistered);
      feedback("success");
    } catch (e) {
      console.error(e);
      feedback("error");
      toast.error(e instanceof Error ? e.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  };

  const commitAll = async () => {
    if (editingIdx === null || !draft) return;
    const idx = editingIdx;

    if (idx === -1) {
      // Adding new
      const desc = draft.description.trim();
      const qtyParsed = Number(draft.qty);
      const priceParsed = Number(draft.price);
      const qty = Number.isFinite(qtyParsed) && qtyParsed > 0 ? +qtyParsed : 1;
      const price = Number.isFinite(priceParsed) && priceParsed > 0 ? +priceParsed.toFixed(2) : 0;
      if (!desc || price <= 0) {
        toast.error("Add a description and price");
        return;
      }
      const newItem: LineItem = {
        description: desc,
        qty,
        unit_price: price,
        category: draft.category,
        source: "voice",
      };
      setEditingIdx(null);
      setDraft(null);
      setSuggestion(null);
      await persist([...items, newItem]);
      return;
    }

    const current = items[idx];
    const nextDesc = draft.description.trim() || current.description;
    const qtyParsed = Number(draft.qty);
    const nextQty = Number.isFinite(qtyParsed) && qtyParsed > 0 ? +qtyParsed : current.qty;
    const priceParsed = Number(draft.price);
    const nextPrice = Number.isFinite(priceParsed) && priceParsed >= 0
      ? +priceParsed.toFixed(2)
      : current.unit_price;
    const priceChanged = nextPrice !== current.unit_price;
    const changed =
      nextDesc !== current.description || nextQty !== current.qty || priceChanged || (draft.category !== (current.category ?? "other"));
    setEditingIdx(null);
    setDraft(null);
    if (!changed) return;
    const next = items.map((li, i) =>
      i === idx
        ? {
            ...li,
            description: nextDesc,
            qty: nextQty,
            unit_price: nextPrice,
            category: draft.category,
            ...(priceChanged ? { source: "voice" as const } : {}),
          }
        : li,
    );
    await persist(next);
  };

  const inputClass =
    "h-11 bg-paper border border-border rounded-md px-3 text-base outline-none focus:border-ink";

  const renderEditPanel = (li: LineItem | null, key: string) => {
    if (!draft) return null;
    const isNew = li === null;
    return (
      <li key={key} className="px-5 py-4 border-t border-border first:border-t-0 bg-secondary/30">
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </label>
            <input
              autoFocus
              type="text"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitAll();
                if (e.key === "Escape") cancelEdit();
              }}
              placeholder={isNew ? "e.g. Replace shower mixer" : undefined}
              className={`${inputClass} w-full`}
            />
            {isNew && suggestion && suggestion.typical_price > 0 && (
              <button
                type="button"
                onClick={() => setDraft({ ...draft, price: suggestion.typical_price.toFixed(2) })}
                className="mt-2 w-full inline-flex items-center justify-center gap-2 h-11 rounded-md border border-dashed border-ink/30 bg-paper text-sm font-medium text-ink hover:bg-secondary"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Last time: {formatGBP(suggestion.typical_price)} · used {suggestion.price_count}×
              </button>
            )}
          </div>
          <div className="flex items-end gap-3">
            <div className="space-y-1 shrink-0">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Qty
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={draft.qty}
                onChange={(e) => setDraft({ ...draft, qty: e.target.value })}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitAll();
                  if (e.key === "Escape") cancelEdit();
                }}
                className={`${inputClass} w-24 text-right num`}
              />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Unit price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base">£</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitAll();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className={`${inputClass} w-full pl-7 text-right num`}
                />
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Category
            </label>
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as LineItemCategory })}
              className={`${inputClass} w-full`}
            >
              <option value="labour">Labour</option>
              <option value="materials">Materials</option>
              <option value="certificate">Certificate</option>
              <option value="cis_labour">CIS Labour</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={cancelEdit}
              className="h-10 px-4 rounded-md text-sm font-medium border border-border bg-paper hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={commitAll}
              className="h-10 px-5 rounded-md text-sm font-semibold bg-ink text-paper hover:bg-ink/90"
            >
              {isNew ? "Add" : "Done"}
            </button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <>
      <ul>
        {items.map((li, i) => {
          const effectiveSource = normalizeSource(li.source, paidQuoteCount);
          const label = badgeText(effectiveSource);
          const isEditing = editingIdx === i;
          if (isEditing && draft) {
            return renderEditPanel(li, `edit-${i}`);
          }
          return (
            <li
              key={i}
              className="px-5 py-3 flex items-start gap-3 border-t border-border first:border-t-0"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{li.description}</span>
                  {label && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeClass(effectiveSource)}`}
                    >
                      {label}
                    </span>
                  )}
                </div>
                {(li as any).category !== "labour" && (li as any).category !== "cis_labour" && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="num">{(li as any).unit === "hours" ? `${li.qty} ${li.qty === 1 ? "hr" : "hrs"}` : (li as any).unit === "days" ? `${li.qty} ${li.qty === 1 ? "day" : "days"}` : li.qty}</span> × <span className="num">{formatGBP(li.unit_price)}{(li as any).unit === "hours" ? "/hr" : (li as any).unit === "days" ? "/day" : ""}</span>
                  </p>
                )}
              </div>
              <span className="num text-base text-ink">
                {formatGBP(li.qty * li.unit_price)}
              </span>
              <button
                type="button"
                onClick={() => beginEdit(i)}
                aria-label="Edit line item"
                className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-ink shrink-0"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </li>
          );
        })}
        {isAdding && draft
          ? renderEditPanel(null, "add-new")
          : (
            <li className="border-t border-border first:border-t-0">
              <button
                type="button"
                onClick={beginAdd}
                className="w-full px-5 py-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-ink/70 hover:text-ink hover:bg-secondary/40 transition"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Add line
              </button>
            </li>
          )}
      </ul>




      <div className="px-5 py-4 border-t border-border bg-secondary/40 space-y-1.5">
        <Row label="Subtotal" value={formatGBP(subtotal)} />
        {vatRegistered && <Row label="VAT (20%)" value={formatGBP(vat)} />}
        <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-border">
          <span className="text-sm uppercase tracking-widest font-semibold">Total</span>
          <span className="num text-3xl text-ink">{formatGBP(total)}</span>
        </div>
        {depositPaid > 0 && (
          <>
            <Row label="Less deposit paid" value={`−${formatGBP(depositPaid)}`} />
            <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-border">
              <span className="text-sm uppercase tracking-widest font-semibold">Balance due</span>
              <span className="num text-2xl text-ink">{formatGBP(Math.max(0, total - depositPaid))}</span>
            </div>
          </>
        )}

        {saving && (
          <p className="text-[10px] text-muted-foreground pt-1">Saving…</p>
        )}
      </div>
    </>
  );
}

import { createFileRoute, Link, Navigate, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import {
  getQuote, getClient, userProfile, formatGBP, waLink,
  buildInvoiceMessage, buildJobDoneMessage, stripePaymentLink, buildPaymentRequest,
  duplicateQuote, buildDepositOnAcceptMessage, markInvoiced, ensureChasesFor, cancelChasesFor,
  setQuoteStatus, updateQuoteLineItems, markJobComplete, updateQuotePaymentTiming, markQuotePaid,
  
  deleteQuote,
  materialsForQuote, cleanItemDescription, lineIsEstimate, parseMoney,
  type PaymentMethod, type PaymentRequest, type PaymentRequestType, type Quote, type LineItem, type LineItemCategory,
} from "@/lib/user-data";
import { createInvoiceCheckout, recordManualDeposit, removeManualDeposit, getQuotePaymentStatus } from "@/lib/payments.functions";
import { sendInvoiceEmailForQuote } from "@/lib/invoice-email.functions";
import { getPortalLinkStatusForQuote, regeneratePortalCode } from "@/lib/portal.functions";
import { MessageCircle, Mail, Phone, CreditCard, Landmark, Banknote, Check, CheckCircle2, Zap, Loader2, ThumbsUp, Copy, FileText, Share2, Send, XCircle, MessageSquare, Smartphone, Nfc, AlertTriangle, Clock, Sparkles, Eye, Trash2, Pencil, Plus, ShoppingCart, ChevronDown, ChevronRight, RotateCcw, Undo2, Mic } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MaterialListSheet } from "@/components/MaterialListSheet";
import { suggestPriceForDescription } from "@/lib/pricing-patterns.functions";
import {
  computeDepositAmount, computeDepositPercent, parseDepositInput,
  paymentTimingLabel, defaultDepositPercent,
  type PaymentTiming,
} from "@/lib/payment-timing";
import { downloadOrShareQuotePdf } from "@/lib/pdf";
import { toast } from "sonner";
import { feedback, playSample } from "@/lib/feedback";
import { SendQuoteDialog } from "@/components/SendQuoteDialog";
import { AssignClientDialog } from "@/components/AssignClientDialog";
import { listQuoteMessages, sendProMessage } from "@/lib/messages.functions";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useCallback } from "react";
import { usePaidQuoteCount, useInvalidatePaidQuoteCount, normalizeSource } from "@/hooks/usePaidQuoteCount";
import { useScrollVisible } from "@/hooks/use-scroll-direction";
import { useConnectStatus } from "@/hooks/useConnectStatus";



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
  notFoundComponent: () => (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center gap-4">
      <p className="text-base font-semibold text-ink">Quote not found</p>
      <p className="text-sm text-muted-foreground max-w-[28ch]">
        This quote may have been deleted or the link is wrong.
      </p>
      <Link
        to="/quotes"
        className="inline-flex items-center bg-lime text-ink rounded-full px-5 py-2.5 text-xs font-bold active:scale-95 transition"
      >
        Back to quotes
      </Link>
    </div>
  ),
  validateSearch: (s: Record<string, unknown>) => ({
    ...(s.sent === 1 || s.sent === "1" ? { sent: 1 as const } : {}),
    ...(s.paid === 1 || s.paid === "1" ? { paid: 1 as const } : {}),
    ...(s.cancelled === 1 || s.cancelled === "1" ? { cancelled: 1 as const } : {}),
    ...(typeof s.tab === "string" ? { tab: s.tab } : {}),
  }),
});

function QuoteDetail() {
  const { quoteId } = Route.useParams();
  const search = Route.useSearch() as { sent?: 1 };
  const wasJustSent = search.sent === 1;
  const quote = getQuote(quoteId);
  if (!quote) throw notFound();
  // Drafts (pending) belong in the editor unless the user just sent it
  if (quote.status === "pending" && !wasJustSent) {
    return <Navigate to="/quotes/new" search={{ edit: quote.id }} />;
  }
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
  const [confirmJobDone, setConfirmJobDone] = useState(false);
  const [jobDoneResult, setJobDoneResult] = useState<{
    mode: "invoice" | "balance" | "receipt";
    emailedTo: string | null;
    emailFailed: boolean;
    amountCents: number;
    depositPaidCents: number;
    waMessage: string | null;
  } | null>(null);
  const [resending, setResending] = useState(false);
  const [invoicedAt, setInvoicedAt] = useState<string | undefined>(quote.invoiced_at);
  const [completedAt, setCompletedAt] = useState<string | undefined>(quote.completed_at);
  const [sendOpen, setSendOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [actioning, setActioning] = useState(false);
  
  const [timingOpen, setTimingOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const materialsCount = materialsForQuote(quote).length;
  const showMaterialsCta = status === "accepted";

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
  const connect = useConnectStatus();
  const canTakePayment = connect.chargesEnabled;
  const paymentsBlocked = !connect.loading && !canTakePayment;
  const fetchPortalStatus = useServerFn(getPortalLinkStatusForQuote);
  const regeneratePortalCodeFn = useServerFn(regeneratePortalCode);
  const recordDepositFn = useServerFn(recordManualDeposit);
  const removeDepositFn = useServerFn(removeManualDeposit);
  const fetchPaymentsFn = useServerFn(getQuotePaymentStatus);
  const sendInvoiceEmailFn = useServerFn(sendInvoiceEmailForQuote);
  const [recordingDeposit, setRecordingDeposit] = useState(false);
  const [recordDepositOpen, setRecordDepositOpen] = useState(false);
  const [depositRecorded, setDepositRecorded] = useState(false);
  const [depositPaid, setDepositPaid] = useState(0);

  // Confirm dialogs (replacing window.confirm for parity with Settings).
  const [confirmRemoveDeposit, setConfirmRemoveDeposit] = useState(false);
  const [confirmMarkUnpaid, setConfirmMarkUnpaid] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // "Just sent" banner — auto-dismiss after 5s and strip ?sent=1 so a refresh doesn't reshow it.
  const [showSentBanner, setShowSentBanner] = useState(wasJustSent);
  useEffect(() => {
    if (!wasJustSent) return;
    const t = setTimeout(() => setShowSentBanner(false), 5000);
    return () => clearTimeout(t);
  }, [wasJustSent]);
  useEffect(() => {
    if (!wasJustSent || typeof window === "undefined") return;
    // Remove ?sent=1 (and ?paid / ?cancelled if present) once consumed.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("sent")) {
        url.searchParams.delete("sent");
        window.history.replaceState({}, "", url.pathname + (url.search || "") + url.hash);
      }
    } catch { /* noop */ }
  }, [wasJustSent]);


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

  const refreshPayments = useCallback(async () => {
    try {
      const res = await fetchPaymentsFn({ data: { quoteId: quote.id } });
      const rows = res?.payments ?? [];
      const paid = rows
        .filter((r) => r.status === "paid" && r.request_type === "deposit")
        .reduce((sum, r) => sum + (Number(r.amount_cents) || 0), 0) / 100;
      setDepositPaid(paid);
      setDepositRecorded(paid > 0);
    } catch { /* non-blocking */ }
  }, [quote.id, fetchPaymentsFn]);

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
      await refreshPayments();
      // Brief delay so the user sees the success state before the sheet closes.
      setTimeout(() => {
        setAskDeposit(false);
        setRecordDepositOpen(false);
      }, 800);
    } catch (e) {
      feedback("error");
      toast.error(e instanceof Error ? e.message : "Couldn't record deposit");
    } finally {
      setRecordingDeposit(false);
    }
  };

  useEffect(() => {
    void refreshPayments();
  }, [refreshPayments]);


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
      toast.error(e instanceof Error ? e.message : "Couldn't regenerate link");
    } finally {
      setRegenerating(false);
    }
  };

  const setMethod = (m: PaymentMethod) => { quote.payment_method = m; setMethodState(m); };
  const acceptQuote = async () => {
    try {
      await setQuoteStatus(quote.id, "accepted");
      setStatusState("accepted");
      if (timing === "deposit_then_balance" && configuredDeposit > 0) {
        setAskDeposit(true);
      } else {
        feedback("success");
        toast.success("Accepted. Nice one.");
      }
    } catch (e) {
      feedback("error"); toast.error(e instanceof Error ? e.message : "Couldn't update status");
    }
  };
  const markSent = async () => {
    try {
      await setQuoteStatus(quote.id, "sent");
      setStatusState("sent");
      feedback("success"); toast.success("Marked sent");
    } catch (e) {
      feedback("error"); toast.error(e instanceof Error ? e.message : "Couldn't update status");
    }
  };
  const declineQuote = async () => {
    try {
      await setQuoteStatus(quote.id, "declined");
      setStatusState("declined");
      feedback("success"); toast.success("Marked declined");
    } catch (e) {
      feedback("error"); toast.error(e instanceof Error ? e.message : "Couldn't update status");
    }
  };
  const removeRecordedDeposit = () => setConfirmRemoveDeposit(true);
  const confirmRemoveRecordedDeposit = async () => {
    setConfirmRemoveDeposit(false);
    try {
      await removeDepositFn({ data: { quoteId: quote.id } });
      setDepositPaid(0);
      setDepositRecorded(false);
      await refreshPayments();
      feedback("success"); toast.success("Deposit removed");
    } catch (e) {
      feedback("error"); toast.error(e instanceof Error ? e.message : "Couldn't remove deposit");
    }
  };

  const markUnpaid = () => setConfirmMarkUnpaid(true);
  const confirmMarkUnpaidAction = async () => {
    setConfirmMarkUnpaid(false);
    try {
      await setQuoteStatus(quote.id, "completed");
      setStatusState("completed");
      feedback("success"); toast.success("Marked unpaid");
    } catch (e) {
      feedback("error"); toast.error(e instanceof Error ? e.message : "Couldn't update status");
    }
  };

  // (confirmSchedule removed)
  const markPaid = async (m: PaymentMethod) => {
    try {
      await markQuotePaid(quote.id, m);
      setPaidViaState(m); setStatusState("paid"); setAskingPaid(false);
      feedback("success");
      celebratePaid(quote.total);
      invalidatePaidQuoteCount();
      // Fire-and-forget branded paid-invoice email; status is shown on
      // the invoice screen.
      sendInvoiceEmailFn({ data: { quoteId: quote.id, mode: "receipt" } }).catch(() => {});
    } catch (e) {
      feedback("error");
      toast.error(e instanceof Error ? e.message : "Couldn't mark as paid");
    }
  };
  const duplicate = async () => {
    try {
      const copy = await duplicateQuote(quote.id);
      if (!copy) return;
      feedback("success"); toast.success(`Quote duplicated as ${copy.ref}`);
      navigate({ to: "/quotes/$quoteId", params: { quoteId: copy.id } });
    } catch (e) {
      feedback("error"); toast.error(e instanceof Error ? e.message : "Couldn't duplicate quote");
    }
  };
  const removeQuote = () => setConfirmDelete(true);
  const confirmRemoveQuote = async () => {
    setConfirmDelete(false);
    try {
      await deleteQuote(quote.id);
      feedback("success"); toast.success("Quote deleted");
      navigate({ to: "/quotes" });
    } catch (e) {
      feedback("error"); toast.error(e instanceof Error ? e.message : "Couldn't delete quote");
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
      navigate({ to: "/invoices/$quoteId", params: { quoteId: quote.id } });
    } catch (e) {
      feedback("error"); toast.error(e instanceof Error ? e.message : "Couldn't issue invoice");
    }
  };
  const createPaymentRequest = async (type: PaymentRequestType, amount?: number) => {
    setCreating(true);
    setError(null);
    try {
      const amt =
        type === "deposit" ? configuredDeposit :
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
      setError(e?.message ?? "Couldn't create Stripe payment link");
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
        type === "deposit" ? configuredDeposit :
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
      toast.error(e?.message ?? "Couldn't start payment");
      setTakingOnSite(false);
    }
  };



  const liveQuote: Quote = { ...quote, payment_method: method, status, paid_via: paidVia, payment_request: paymentRequest };
  const sharePdf = async () => {
    try {
      const r = await downloadOrShareQuotePdf(liveQuote, client, "quote");
      if (!r.shared && !r.cancelled) { feedback("success"); toast.success("PDF saved"); }
    } catch (e) {
      feedback("error"); toast.error(e instanceof Error ? e.message : "Couldn't generate PDF");
    }
  };
  // Single payment-type-aware "Job done" action.
  // Mode is derived from payment_timing + current status:
  //  - "receipt": already-paid-in-full (upfront or otherwise) → thank-you, no chases.
  //  - "balance": deposit_then_balance → final invoice for the outstanding balance.
  //  - "invoice": on_completion (default) → full final invoice.
  const jobDoneMode: "invoice" | "balance" | "receipt" =
    (status === "paid" || timing === "upfront")
      ? "receipt"
      : timing === "deposit_then_balance"
      ? "balance"
      : "invoice";
  const jobDoneAmount =
    jobDoneMode === "balance"
      ? Math.max(0, +(Number(quote.total) - Number(depositPaid || 0)).toFixed(2))
      : Number(quote.total);
  const jobDoneFirst = client?.name?.split(" ")[0] ?? "the customer";
  const jobDonePreview = (() => {
    if (jobDoneMode === "receipt") {
      return {
        title: `Mark done and send ${jobDoneFirst} a paid-in-full receipt?`,
        body: `We'll mark "${quote.title}" complete and send ${jobDoneFirst} a paid-in-full receipt (${formatGBP(quote.total)} — already paid). No further payment will be requested.`,
      };
    }
    if (jobDoneMode === "balance") {
      return {
        title: `Mark done and send the ${formatGBP(jobDoneAmount)} balance to ${jobDoneFirst}?`,
        body: `We'll mark the job complete and send ${jobDoneFirst} an invoice for the ${formatGBP(jobDoneAmount)} balance (${formatGBP(depositPaid)} deposit already paid).${client?.email ? ` Emailed to ${client.email}.` : ""}`,
      };
    }
    return {
      title: `Mark done and send the ${formatGBP(jobDoneAmount)} invoice to ${jobDoneFirst}?`,
      body: `We'll mark the job complete and send ${jobDoneFirst} the final ${formatGBP(jobDoneAmount)} invoice.${client?.email ? ` Emailed to ${client.email}.` : ""}`,
    };
  })();

  const jobDone = async () => {
    try {
      // 1. Mark complete if not already.
      if (!completedAt && status !== "completed") {
        const c = await markJobComplete(quote.id);
        if (c?.completed_at) setCompletedAt(c.completed_at);
        setStatusState((s) => (s === "paid" ? "paid" : "completed"));
      }

      // 2. Issue invoice record (gives invoice_due_date, chases, /invoices PDF).
      //    For receipt mode, skip: no chases on already-paid work.
      if (jobDoneMode !== "receipt" && !invoicedAt) {
        const inv = await markInvoiced(quote.id);
        if (inv?.invoiced_at) setInvoicedAt(inv.invoiced_at);
        if (inv) ensureChasesFor(inv);
      } else if (jobDoneMode === "receipt") {
        // Bulletproof: an already-paid customer must never get chase reminders.
        cancelChasesFor(quote.id);
      }

      // 3. Auto-email via Resend (best-effort). The invoice screen shows status.
      const amountCents = Math.round(jobDoneAmount * 100);
      const depositPaidCents = jobDoneMode === "balance" ? Math.round(depositPaid * 100) : 0;
      let emailedTo: string | null = null;
      let emailFailed = false;
      try {
        const res = await sendInvoiceEmailFn({
          data: { quoteId: quote.id, mode: jobDoneMode, amountCents, depositPaidCents },
        });
        const s = (res as { status?: string } | null)?.status;
        if (s === "sent") emailedTo = (res as { to?: string }).to ?? client?.email ?? null;
        else if (s === "failed") emailFailed = true;
        // "skipped" → neither (no email on file); WhatsApp fallback applies.
      } catch {
        emailFailed = true;
      }

      // 4. Tell the trader what happened via the post-send sheet.
      feedback("success");
      const waMessage = client?.phone
        ? buildJobDoneMessage(liveQuote, jobDoneFirst, jobDoneMode, jobDoneAmount, depositPaid)
        : null;
      setJobDoneResult({ mode: jobDoneMode, emailedTo, emailFailed, amountCents, depositPaidCents, waMessage });
    } catch (e) {
      feedback("error");
      toast.error(e instanceof Error ? e.message : "Couldn't complete the job");
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
  // Clear any pending debounce on unmount so a write doesn't fire against a
  // stale quote ref after the user navigates away.
  useEffect(() => {
    return () => {
      if (timingSaveTimer.current) {
        clearTimeout(timingSaveTimer.current);
        timingSaveTimer.current = null;
      }
    };
  }, []);
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
  if (status === "pending") {
    primary = client
      ? { label: `Send to ${client.name.split(" ")[0]}`, icon: Send, onClick: () => setSendOpen(true) }
      : { label: "Add client to send", icon: Send, onClick: () => setAssignOpen(true) };
  } else if (status === "declined") {
    primary = {
      label: "Reopen quote",
      icon: RotateCcw,
      onClick: async () => {
        try { await setQuoteStatus(quote.id, "pending"); setStatusState("pending"); }
        catch (e) { feedback("error"); toast.error(e instanceof Error ? e.message : "Couldn't reopen"); }
      },
    };
  } else if (status === "sent") {
    primary = { label: "Customer accepted", icon: ThumbsUp, onClick: acceptQuote };
  } else if (status === "accepted") {
    // ONE smart action — handles complete + invoice/balance/receipt together,
    // dispatched by jobDoneMode (derived from payment_timing).
    const label =
      jobDoneMode === "receipt" ? "Job done — send receipt" :
      jobDoneMode === "balance" ? `Job done — send ${formatGBP(jobDoneAmount)} balance` :
      "Job done — send invoice";
    primary = { label, icon: Check, onClick: () => setConfirmJobDone(true) };
  } else if (status === "paid" && !completedAt) {
    // Upfront-paid quotes still need a "job done" tap to mark complete + send a receipt.
    primary = { label: "Job done — send receipt", icon: Check, onClick: () => setConfirmJobDone(true) };
  } else if (status === "completed") {
    // Fallback: customer paid by cash/bank outside the app. Mark Paid is the
    // only remaining manual step here.
    primary = { label: "Mark paid (cash / bank)", icon: CheckCircle2, onClick: () => setAskingPaid(true) };
  } else if (status === "paid") {
    primary = { label: invoicedAt ? "Share invoice" : "Share receipt", icon: Share2, onClick: sharePdf };
  } else {
    primary = { label: "Share PDF", icon: Share2, onClick: sharePdf };
  }
  const PrimaryIcon = primary.icon;
  const messageBody = buildInvoiceMessage(liveQuote, client?.name.split(" ")[0] ?? "there");
  const waHref = waLink(client?.phone, messageBody);
  const mailHref = `mailto:${client?.email}?subject=${encodeURIComponent(`Invoice ${quote.ref}, ${quote.title}`)}&body=${encodeURIComponent(messageBody)}`;

  // Plan 1: bar hides on downscroll, returns on upscroll / near bottom.
  // Always-visible when waiting on a missing client (the "Add client to send"
  // CTA is the entire purpose of the page in that state).
  const scrollWantsVisible = useScrollVisible();
  const needsClient = status === "pending" && !client;
  const barVisible = needsClient || scrollWantsVisible;

  // Secondary "chase" action: shown on the LEFT of the primary when the quote
  // has been SENT but sitting idle > 3 days.
  const sentMs = quote.created_at ? new Date(quote.created_at).getTime() : 0;
  const showChaseSecondary = status === "sent" && client?.phone && sentMs && (Date.now() - sentMs) > 3 * 86_400_000;

  // Wrap primary.onClick with the loading/disabled gate. Async handlers
  // (accept/complete/reopen) are awaited; sync ones (open sheets) just toggle
  // briefly so a double-tap can't fire twice.
  const handlePrimary = async () => {
    if (actioning) return;
    setActioning(true);
    try {
      await primary.onClick();
    } finally {
      setActioning(false);
    }
  };


  return (
    <AppShell>
      <PageHeader title={quote.title} subtitle={quote.ref} back="/quotes" crumbs={["Quotes", quote.ref]} />

      {/* Money summary card — glance-level total + status at the top */}
      <div className="mx-5 mt-4 rounded-2xl bg-card border border-border overflow-hidden">
        {showSentBanner && (
          <div className="bg-lime/15 px-4 py-3 flex items-center gap-3 border-b border-border/60">
            <span className="h-8 w-8 rounded-full bg-lime/40 flex items-center justify-center shrink-0">
              <Check className="h-4 w-4 text-ink" strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">Quote sent</p>
              <p className="text-[11px] text-muted-foreground">We'll let you know when they open it.</p>
            </div>
          </div>
        )}
        <div className="p-5 divide-y divide-border/60">
          <div className="pb-4 flex items-start justify-between gap-3">
            <div className="grid grid-cols-2 gap-4 flex-1 min-w-0">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Subtotal</p>
                <p className="text-lg font-bold text-ink num mt-0.5">{formatGBP(quote.subtotal || 0)}</p>
              </div>
              {userProfile.vat_registered && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">VAT (20%)</p>
                  <p className="text-lg font-bold text-ink num mt-0.5">{formatGBP((quote.subtotal || 0) * 0.2)}</p>
                </div>
              )}
            </div>
            <StatusBadge status={status === "paid" ? "paid" : invoicedAt ? "invoiced" : status} />
          </div>
          <div className="py-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink inline-flex items-center gap-1.5">
              {status === "paid" && <Check className="h-4 w-4 text-status-paid" strokeWidth={3} />}
              Total
            </p>
            <p className={`text-2xl font-bold num ${status === "paid" ? "text-status-paid" : "text-ink"}`}>
              {formatGBP(quote.total || 0)}
            </p>
          </div>
          {timing === "deposit_then_balance" && configuredDeposit > 0 && (
            <div className="pt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Deposit due</span>
                <span className="font-bold text-status-pending num">{formatGBP(configuredDeposit)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Balance</span>
                <span className="font-bold text-ink num">{formatGBP((quote.total || 0) - Math.max(configuredDeposit, depositPaid))}</span>
              </div>
              {status !== "paid" && depositPaid === 0 && (
                <button
                  type="button"
                  onClick={() => setRecordDepositOpen(true)}
                  className="mt-2 w-full flex items-center justify-between gap-3 rounded-2xl border border-dashed border-ink/20 bg-muted/40 px-4 py-3 text-left active:bg-muted"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                    <span>
                      <span className="font-semibold text-ink">Deposit not yet received</span>
                      <span className="block text-xs text-muted-foreground">Tap to record a bank or cash payment</span>
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              )}
              {status !== "paid" && depositPaid > 0 && (
                <div className="mt-2 flex items-center justify-between rounded-2xl bg-status-paid/10 px-4 py-3 text-sm">
                  <span className="inline-flex items-center gap-2 font-semibold text-status-paid">
                    <Check className="h-4 w-4" strokeWidth={3} />
                    Deposit received
                  </span>
                  <span className="font-bold num text-status-paid">{formatGBP(depositPaid)}</span>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {status === "declined" && (
        <section className="px-5 mt-5">
          <div className="card-surface p-3 text-center text-sm text-muted-foreground">
            Customer declined this quote. <button onClick={async () => { try { await setQuoteStatus(quote.id, "pending"); setStatusState("pending"); } catch (e) { feedback("error"); toast.error(e instanceof Error ? e.message : "Couldn't reopen"); } }} className="underline font-semibold text-ink ml-1">Reopen</button>
          </div>
        </section>
      )}

      {client && (
        <section className="px-5 mt-5">
          <Link to="/clients/$clientId" params={{ clientId: client.id }} className="card-surface p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-lime/30 flex items-center justify-center text-ink font-bold">
              {client.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{client.name}</p>
              <p className="text-xs text-muted-foreground truncate">{client.address}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        </section>
      )}

      {userProfile.quote_intro && (
        <p className="px-6 mt-5 text-sm leading-relaxed italic text-muted-foreground">
          {userProfile.quote_intro}
        </p>
      )}

      {/* Job description + Itemised — single divided card */}
      <section className="px-5 mt-5">
        <div className="card-surface overflow-hidden divide-y divide-border">
          <div className="p-5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Job description</p>
            <p className="text-sm mt-2 leading-relaxed">{quote.job_description}</p>
          </div>
          <div>
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
        </div>
      </section>

      {/* Payment terms — visible at a glance, whole card is the tap target */}
      <section className="px-5 mt-6">
        <button
          type="button"
          onClick={() => setTimingOpen(true)}
          className="w-full text-left rounded-2xl border-2 border-lime bg-lime/10 px-4 py-3 flex items-center justify-between gap-3 active:scale-[0.99] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Change payment terms"
        >
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-0.5">Payment terms</p>
            <p className="text-sm font-bold text-ink leading-tight">
              {paymentTimingLabel({ timing, total: quote.total, depositAmount: depositAmt, depositPercent: depositPct })}
            </p>
          </div>
          <ChevronDown className="h-4 w-4 text-ink/60 shrink-0" />
        </button>
      </section>


      {/* Materials — next step after payment terms */}
      {showMaterialsCta && (
        <section className="px-5 mt-3">
          <button
            type="button"
            onClick={() => setMaterialsOpen(true)}
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 flex items-center gap-3 text-left active:scale-[0.99] transition"
          >
            <div className="h-10 w-10 rounded-full bg-lime text-ink flex items-center justify-center shrink-0">
              <ShoppingCart className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-0.5">Materials</p>
              <p className="text-sm font-bold text-ink leading-tight">
                {materialsCount > 0
                  ? `${materialsCount} item${materialsCount === 1 ? "" : "s"} on the list`
                  : "No materials yet — add what you need for this job"}
              </p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-ink underline underline-offset-2">
              {materialsCount > 0 ? "Open" : "Add"}
            </span>
          </button>
        </section>
      )}

      {(userProfile.quote_footer || (userProfile.show_signature && (userProfile.signature_name || userProfile.full_name))) && (
        <section className="px-5 mt-5 space-y-2">
          {userProfile.quote_footer && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">{userProfile.quote_footer}</p>
          )}
          {userProfile.show_signature && (userProfile.signature_name || userProfile.full_name) && (
            <p className="text-[11px] text-muted-foreground">
              <span className="text-sm text-ink" style={{ fontFamily: "'Caveat', 'Bradley Hand', cursive" }}>
                — {userProfile.signature_name || userProfile.full_name}
              </span>
              {" · "}{userProfile.business_name}
            </p>
          )}
        </section>
      )}

      {/* Options: secondary controls + actions, collapsed by default */}
      <section className="px-5 mt-5">
        <Accordion type="single" collapsible className="card-surface px-4">
          <AccordionItem value="options" className="border-b-0">
            <AccordionTrigger className="text-sm font-semibold text-ink hover:no-underline py-4">
              <span className="flex flex-col items-start gap-0.5">
                <span>More actions</span>
                <span className="text-[11px] font-normal text-muted-foreground">Share, payments, customer link</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-1">
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

              {/* Action shortcuts — grouped by purpose */}
              <ul className="divide-y divide-border/40 pt-1">
                <MoreGroup label="Share" />
                <MoreItem icon={Eye} label="View as customer" onClick={viewAsCustomer} />
                <MoreItem icon={Share2} label="Download PDF" onClick={sharePdf} />
                <MoreItem icon={Mail} label="Email customer" onClick={() => { window.location.href = mailHref; }} />
                <MoreItem icon={Phone} label="Call customer" onClick={() => { window.location.href = `tel:${client?.phone}`; }} />
                {(status === "sent" || status === "accepted" || invoicedAt) && status !== "paid" && client?.phone && (
                  <MoreItem icon={MessageCircle} label="Chase on WhatsApp" onClick={() => {
                    const first = client.name.split(" ")[0] ?? "there";
                    const msg = `Hi ${first}, just following up on ${quote.ref} for ${formatGBP(quote.total)}. Could you let me know when payment will be made? Thanks.`;
                    window.open(waLink(client.phone, msg), "_blank");
                  }} />
                )}
                {invoicedAt && (
                  <MoreItem icon={FileText} label="View final invoice" onClick={() => navigate({ to: "/invoices/$quoteId", params: { quoteId: quote.id } })} chevron />
                )}

                <MoreGroup label="Payments" />
                {status !== "paid" && (
                  <MoreItem icon={CheckCircle2} label="Mark paid" onClick={() => setAskingPaid(true)} chevron />
                )}
                {status === "paid" && (
                  <MoreItem icon={RotateCcw} label="Mark unpaid" onClick={markUnpaid} chevron />
                )}
                {status !== "paid" && timing === "deposit_then_balance" && configuredDeposit > 0 && (
                  <MoreItem
                    icon={Banknote}
                    label={`Record deposit received (${formatGBP(configuredDeposit)})`}
                    onClick={() => setRecordDepositOpen(true)}
                    chevron
                  />
                )}
                {status !== "paid" && depositPaid > 0 && (
                  <MoreItem icon={Undo2} label="Remove deposit" onClick={removeRecordedDeposit} chevron />
                )}
                {status === "accepted" && canTakePayment && (
                  <MoreItem icon={Zap} label="Send a payment link" onClick={() => setRequesting(true)} chevron />
                )}
                {(status === "accepted" || status === "sent") && canTakePayment && (
                  <MoreItem icon={Smartphone} label="Take payment now" onClick={() => takePaymentOnSite("full")} />
                )}
                {(status === "accepted" || status === "sent") && paymentsBlocked && (
                  <li className="px-3 py-3">
                    <div className="rounded-2xl bg-secondary/60 border border-border p-3">
                      <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Set up payments first
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Connect your bank in Settings to take card payments. Funds go straight to you.
                      </p>
                      <Link
                        to="/settings"
                        className="mt-2 inline-flex items-center bg-ink text-paper rounded-full px-3 py-1.5 text-[11px] font-bold"
                      >
                        Connect bank
                      </Link>
                    </div>
                  </li>
                )}

                <MoreGroup label="Status" />
                <MoreItem icon={Copy} label="Copy quote" onClick={duplicate} />
                {status === "pending" && (
                  <MoreItem icon={Send} label="Mark sent" onClick={markSent} />
                )}
                {status !== "declined" && status !== "paid" && (
                  <MoreItem icon={XCircle} label="Mark declined" onClick={declineQuote} />
                )}

                <MoreGroup label="Danger" />
                <MoreItem icon={Trash2} label="Delete quote" onClick={removeQuote} danger chevron />
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>


      {/* Spacer so content isn't hidden behind sticky bar + bottom nav */}
      <div className="h-32" aria-hidden />

      {/* Sticky bottom action bar — single primary action.
          Hides on downscroll, returns on upscroll / near bottom (Plan 1). */}
      <div
        className={`fixed inset-x-0 z-40 pointer-events-none transition-transform duration-200 ${barVisible ? "translate-y-0" : "translate-y-[140%]"}`}
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-md px-4 pointer-events-auto">
          <div className="h-6 -mb-2 bg-gradient-to-t from-paper via-paper/80 to-paper/0" aria-hidden />
          <div className="bg-paper pt-2 pb-1 flex items-center gap-2">
            {showChaseSecondary && waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                onPointerDown={() => feedback("tap")}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-card border border-border text-ink px-4 py-3.5 text-xs font-bold active:scale-[0.98]"
                aria-label="Send chaser on WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
                Chase
              </a>
            )}
            <button
              onClick={handlePrimary}
              onPointerDown={() => feedback("tap")}
              disabled={actioning}
              className="flex-1 bg-lime text-ink rounded-full py-3.5 font-bold inline-flex items-center justify-center gap-2 text-sm shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {actioning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PrimaryIcon className="h-4 w-4" />
              )}
              {primary.label}
            </button>
          </div>
        </div>
      </div>




      {/* Bottom sheet: payment timing */}
      {timingOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/60" onClick={() => setTimingOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-paper rounded-t-3xl p-5 pb-6" onClick={(e) => e.stopPropagation()}>
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
          <div className="w-full max-w-md mx-auto bg-paper rounded-t-3xl p-5 pb-6" onClick={(e) => e.stopPropagation()}>
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
          <div className="w-full max-w-md mx-auto bg-paper rounded-t-3xl p-5 pb-6" onClick={(e) => e.stopPropagation()}>
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
                label={`Deposit${configuredDepositPct ? ` (${configuredDepositPct}%)` : ""}`}
                amount={formatGBP(configuredDeposit)}
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
                    disabled={!customAmt || !(parseMoney(customAmt) > 0) || creating}
                    onClick={() => createPaymentRequest("custom", parseMoney(customAmt))}
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
          <div className="w-full max-w-md mx-auto bg-paper rounded-t-3xl p-5 pb-6" onClick={(e) => e.stopPropagation()}>
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


      {/* Confirm: Job done (mark complete + auto-send invoice/balance/receipt) */}
      <AlertDialog open={confirmJobDone} onOpenChange={setConfirmJobDone}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{jobDonePreview.title}</AlertDialogTitle>
            <AlertDialogDescription>{jobDonePreview.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmJobDone(false); void jobDone(); }}>
              Yes, do it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Confirm dialogs — replace native window.confirm for parity with Settings */}
      <AlertDialog open={confirmRemoveDeposit} onOpenChange={setConfirmRemoveDeposit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove the recorded deposit?</AlertDialogTitle>
            <AlertDialogDescription>
              The balance will go back to the full amount.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveRecordedDeposit}>Remove deposit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Post-send: confirmation of email + optional WhatsApp backup, OR WhatsApp fallback */}
      <Sheet open={!!jobDoneResult} onOpenChange={(o) => { if (!o) setJobDoneResult(null); }}>
        <SheetContent side="bottom" className="rounded-t-3xl border-0 bg-paper p-0">
          {jobDoneResult && (() => {
            const docLabel = jobDoneResult.mode === "receipt" ? "Receipt" : "Invoice";
            const docLower = docLabel.toLowerCase();
            const emailed = !!jobDoneResult.emailedTo;
            const failed = jobDoneResult.emailFailed;
            const phone = client?.phone;
            const openWa = () => {
              if (phone && jobDoneResult.waMessage) {
                window.open(waLink(phone, jobDoneResult.waMessage), "_blank");
              }
            };
            const goToInvoice = () => {
              setJobDoneResult(null);
              navigate({ to: "/invoices/$quoteId", params: { quoteId: quote.id } });
            };
            const resend = async () => {
              setResending(true);
              try {
                const res = await sendInvoiceEmailFn({
                  data: {
                    quoteId: quote.id,
                    mode: jobDoneResult.mode,
                    amountCents: jobDoneResult.amountCents,
                    depositPaidCents: jobDoneResult.depositPaidCents,
                  },
                });
                const s = (res as { status?: string } | null)?.status;
                if (s === "sent") {
                  const to = (res as { to?: string }).to ?? client?.email ?? null;
                  setJobDoneResult({ ...jobDoneResult, emailedTo: to, emailFailed: false });
                  toast.success(`${docLabel} emailed to ${jobDoneFirst}.`);
                } else {
                  toast.error("Email still didn't send — try WhatsApp.");
                }
              } catch {
                toast.error("Email still didn't send — try WhatsApp.");
              } finally {
                setResending(false);
              }
            };
            return (
              <>
                <SheetHeader className="px-5 pt-5 pb-1 text-left">
                  <SheetTitle className="text-base font-semibold">
                    {emailed
                      ? `${docLabel} emailed to ${jobDoneFirst} ✓`
                      : failed
                        ? `⚠ Email didn't send`
                        : phone
                          ? `Send ${docLower} via WhatsApp`
                          : `${docLabel} ready — no email or phone on file`}
                  </SheetTitle>
                </SheetHeader>
                <div className="px-5 pb-2 text-sm text-muted-foreground">
                  {emailed
                    ? `Sent to ${jobDoneResult.emailedTo}. You're done — nothing else needed.`
                    : failed
                      ? `We couldn't email ${jobDoneFirst}${client?.email ? ` at ${client.email}` : ""}. Send via WhatsApp now, or retry the email.`
                      : phone
                        ? `No email on file. Send it on WhatsApp instead.`
                        : `Open the invoice screen to share the link manually or retry email.`}
                </div>
                <div className="px-5 pb-6 pt-3 space-y-2">
                  {emailed ? (
                    <>
                      <button
                        onClick={() => setJobDoneResult(null)}
                        className="w-full rounded-full bg-ink text-paper py-3 font-semibold text-sm"
                      >
                        Done
                      </button>
                      {phone && (
                        <button
                          onClick={openWa}
                          className="w-full rounded-full border border-ink/15 py-3 font-semibold text-sm"
                        >
                          Also share on WhatsApp (optional)
                        </button>
                      )}
                      <button
                        onClick={goToInvoice}
                        className="w-full py-2 text-sm text-muted-foreground underline"
                      >
                        View invoice
                      </button>
                    </>
                  ) : failed ? (
                    <>
                      {phone && (
                        <button
                          onClick={() => { openWa(); setJobDoneResult(null); }}
                          className="w-full rounded-full bg-ink text-paper py-3 font-semibold text-sm"
                        >
                          Send via WhatsApp
                        </button>
                      )}
                      <button
                        onClick={resend}
                        disabled={resending}
                        className="w-full rounded-full border border-ink/15 py-3 font-semibold text-sm disabled:opacity-50"
                      >
                        {resending ? "Resending…" : "Resend email"}
                      </button>
                      <button
                        onClick={goToInvoice}
                        className="w-full py-2 text-sm text-muted-foreground underline"
                      >
                        View invoice
                      </button>
                    </>
                  ) : (
                    <>
                      {phone && (
                        <button
                          onClick={() => { openWa(); setJobDoneResult(null); }}
                          className="w-full rounded-full bg-ink text-paper py-3 font-semibold text-sm"
                        >
                          Send via WhatsApp
                        </button>
                      )}
                      <button
                        onClick={goToInvoice}
                        className="w-full rounded-full border border-ink/15 py-3 font-semibold text-sm"
                      >
                        View invoice
                      </button>
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmMarkUnpaid} onOpenChange={setConfirmMarkUnpaid}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this quote as unpaid?</AlertDialogTitle>
            <AlertDialogDescription>
              It will go back to awaiting payment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMarkUnpaidAction}>Mark unpaid</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quote?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveQuote}
              className="bg-status-overdue text-paper hover:bg-status-overdue/90"
            >
              Delete quote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  icon: Icon, label, onClick, danger, chevron,
}: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; danger?: boolean; chevron?: boolean }) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-secondary text-left ${danger ? "text-status-overdue" : "text-ink"}`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="text-sm font-semibold flex-1 min-w-0">{label}</span>
        {chevron && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
    </li>
  );
}

function MoreGroup({ label }: { label: string }) {
  return (
    <li className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
      {label}
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
      toast.error(e instanceof Error ? e.message : "Couldn't save changes");
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
      const priceParsed = parseMoney(draft.price);
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
    const priceParsed = parseMoney(draft.price);
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
              className={`${inputClass} h-12 text-[15px] w-full`}
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
                  onBlur={(e) => {
                    const n = parseMoney(e.target.value);
                    if (Number.isFinite(n) && n > 0) setDraft({ ...draft, price: String(n) });
                  }}
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
        {/* Add line — promoted to the top so it stays visible on long jobs */}
        {isAdding && draft ? (
          renderEditPanel(null, "add-new")
        ) : (
          <li className="border-t border-border first:border-t-0">
            <button
              type="button"
              onClick={beginAdd}
              className="w-full px-5 py-3 inline-flex items-center justify-center gap-2 text-sm font-semibold text-ink hover:bg-secondary/40 transition"
            >
              <span className="h-6 w-6 rounded-full bg-lime text-ink inline-flex items-center justify-center">
                <Plus className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              Add line
            </button>
          </li>
        )}
        {items.map((li, i) => {
          const effectiveSource = normalizeSource(li.source, paidQuoteCount);
          const isEstimate = lineIsEstimate(li);
          const cleanDesc = cleanItemDescription(li.description);
          // Only show the "Quottr suggested" tag on AI-priced lines (the Estimate tag is separate).
          const label = (effectiveSource === "ai" && isEstimate) || effectiveSource === "learned"
            ? badgeText(effectiveSource)
            : null;
          const isEditing = editingIdx === i;
          if (isEditing && draft) {
            return renderEditPanel(li, `edit-${i}`);
          }
          return (
            <li
              key={i}
              className="px-5 py-4 flex items-start gap-3 border-t border-border"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-[15px] leading-snug font-medium text-ink">{cleanDesc}</span>
                  {isEstimate && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-status-pending/15 text-status-pending">
                      Estimate
                    </span>
                  )}
                  {label && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeClass(effectiveSource)}`}
                    >
                      {label}
                    </span>
                  )}
                </div>
                {(li as any).category !== "labour" && (li as any).category !== "cis_labour" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="num">{(li as any).unit === "hours" ? `${li.qty} ${li.qty === 1 ? "hr" : "hrs"}` : (li as any).unit === "days" ? `${li.qty} ${li.qty === 1 ? "day" : "days"}` : li.qty}</span> × <span className="num">{formatGBP(li.unit_price)}{(li as any).unit === "hours" ? "/hr" : (li as any).unit === "days" ? "/day" : ""}</span>
                  </p>
                )}
              </div>
              <span className="num text-lg font-semibold text-ink tabular-nums">
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
      </ul>





      <div className="px-5 py-3 border-t border-border bg-secondary/40 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">Total</span>
        <span className="num text-lg font-bold text-ink">{formatGBP(total)}</span>
      </div>
      {saving && (
        <p className="px-5 py-1 text-[10px] text-muted-foreground border-t border-border bg-secondary/20">Saving…</p>
      )}
    </>
  );
}

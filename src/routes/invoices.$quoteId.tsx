import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  getQuote, getClient, userProfile, formatGBP, waLink,
  invoiceRef, buildFinalInvoiceMessage, markInvoiced, setQuoteStatus,
} from "@/lib/user-data";
import { MessageCircle, Mail, Share2, CheckCircle2, Check, Download, MailCheck, MailX, MailWarning, Loader2 } from "lucide-react";
import { QuottrLogo } from "@/components/QuottrLogo";
import { BusinessLogo } from "@/components/BusinessLogo";
import { downloadOrShareQuotePdf } from "@/lib/pdf";
import { toast } from "sonner";
import { feedback, playSample } from "@/lib/feedback";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getQuotePaymentStatus } from "@/lib/payments.functions";
import { getInvoiceEmailStatus, sendInvoiceEmailForQuote } from "@/lib/invoice-email.functions";

export const Route = createFileRoute("/invoices/$quoteId")({
  component: InvoicePage,
  notFoundComponent: () => (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center gap-4">
      <p className="text-base font-semibold text-ink">Invoice not found</p>
      <p className="text-sm text-muted-foreground max-w-[28ch]">
        This invoice may have been deleted or hasn't been issued yet.
      </p>
      <Link
        to="/quotes"
        className="inline-flex items-center bg-lime text-ink rounded-full px-5 py-2.5 text-xs font-bold active:scale-95 transition"
      >
        Back to quotes
      </Link>
    </div>
  ),
});

function InvoicePage() {
  const { quoteId } = Route.useParams();
  const quote = getQuote(quoteId);
  if (!quote) throw notFound();
  const client = getClient(quote.client_id);
  const ref = invoiceRef(quote);
  const firstName = client?.name.split(" ")[0] ?? "there";
  const body = buildFinalInvoiceMessage(quote, firstName);
  const wa = waLink(client?.phone, body);
  const mail = `mailto:${client?.email}?subject=${encodeURIComponent(`INVOICE ${ref}, ${userProfile.business_name}`)}&body=${encodeURIComponent(body)}`;
  const router = useRouter();
  const isPaid = quote.status === "paid";

  const fetchPaymentStatus = useServerFn(getQuotePaymentStatus);
  const [depositPaid, setDepositPaid] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetchPaymentStatus({ data: { quoteId: quote.id } });
        if (cancelled) return;
        const paid = (res?.payments ?? [])
          .filter((p: any) => p.status === "paid" && p.request_type === "deposit")
          .reduce((sum: number, p: any) => sum + (Number(p.amount_cents) || 0), 0);
        setDepositPaid(paid / 100);
      } catch {
        if (!cancelled) setDepositPaid(0);
      }
    };
    load();
    const onFocus = () => load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [quote.id, fetchPaymentStatus]);

  const balance = Math.max(0, +(quote.total - depositPaid).toFixed(2));
  const dueDate = quote.invoice_due_date
    ? new Date(quote.invoice_due_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "";

  // ---- Paid-invoice email status ----
  const fetchEmailStatus = useServerFn(getInvoiceEmailStatus);
  const resendEmail = useServerFn(sendInvoiceEmailForQuote);
  type EmailStatus = {
    invoice_email_status: string | null;
    invoice_email_sent_at: string | null;
    invoice_email_error: string | null;
    invoice_email_to: string | null;
  };
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [resending, setResending] = useState(false);
  const loadEmailStatus = useCallback(async () => {
    if (!isPaid) { setEmailStatus(null); return; }
    try {
      const res = await fetchEmailStatus({ data: { quoteId: quote.id } });
      setEmailStatus(res as EmailStatus);
    } catch {
      // ignore — UI just won't show a status line
    }
  }, [fetchEmailStatus, quote.id, isPaid]);
  useEffect(() => { loadEmailStatus(); }, [loadEmailStatus]);

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await resendEmail({ data: { quoteId: quote.id } });
      if (res.status === "sent") { feedback("success"); toast.success("Invoice email sent"); }
      else if (res.status === "skipped") { feedback("error"); toast.error("No email on file for this customer"); }
      else { feedback("error"); toast.error("Email failed — try again"); }
      await loadEmailStatus();
    } catch (e) {
      feedback("error"); toast.error(e instanceof Error ? e.message : "Couldn't send email");
    } finally {
      setResending(false);
    }
  };

  const downloadPdf = async () => {
    try {
      await markInvoiced(quote.id);
      const r = await downloadOrShareQuotePdf(quote, client, "invoice");
      if (!r.shared && !r.cancelled) { feedback("success"); toast.success("Invoice saved"); }
    } catch (e) {
      feedback("error"); toast.error(e instanceof Error ? e.message : "Couldn't generate PDF");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Final invoice"
        subtitle={ref}
        back={`/quotes/${quote.id}`}
        crumbs={["Quotes", ref, "Invoice"]}
      />

      {/* Bold INVOICE banner */}
      <section className="px-5">
        <div className="rounded-3xl bg-ink text-paper overflow-hidden divide-y divide-paper/10">
          <div className="px-6 py-6 flex items-start gap-3">
            <BusinessLogo logoUrl={userProfile.logo_url} businessName={userProfile.business_name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.3em] text-lime font-bold">Invoice</p>
              <h1 className="text-3xl mt-1 leading-none text-paper">{ref}</h1>
              <p className="text-xs text-paper/60 mt-2 truncate">{userProfile.business_name}</p>
              {(() => {
                const parts = [
                  userProfile.registration_number,
                  userProfile.vat_registered && userProfile.vat_number ? `VAT ${userProfile.vat_number}` : null,
                ].filter(Boolean);
                return parts.length > 0 ? (
                  <p className="text-[10px] text-paper/50 truncate">{parts.join(" · ")}</p>
                ) : null;
              })()}
            </div>
          </div>

          <div className="px-6 py-6">
            <p className="text-[10px] uppercase tracking-widest text-paper/60 font-bold">{depositPaid > 0 ? "Balance due" : "Amount due"}</p>
            <p className="num text-6xl text-lime leading-none mt-1">{formatGBP(balance)}</p>
            {dueDate && (
              <p className="text-xs text-paper/80 mt-2">
                Payment due by <span className="font-semibold text-paper">{dueDate}</span>
              </p>
            )}
          </div>

          <div className="px-6 py-3 flex items-center justify-end">
            <QuottrLogo className="h-5 w-auto opacity-50" />
          </div>
        </div>
      </section>

      {/* Billed to + For + line items merged */}
      <section className="px-5 mt-4">
        <div className="card-surface overflow-hidden divide-y divide-border">
          <div className="px-5 py-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Billed to</p>
            <p className="font-semibold mt-1">{client?.name}</p>
            {client?.address && <p className="text-xs text-muted-foreground">{client.address}</p>}
          </div>

          <div className="px-5 py-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">For</p>
            <p className="font-semibold text-base mt-1">{quote.title}</p>
            {quote.job_description && (
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">{quote.job_description}</p>
            )}
          </div>

          <ul>
            {quote.line_items.map((li, i) => (
              <li key={i} className="px-5 py-3 flex items-start gap-3 border-t border-border first:border-t-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{li.description}</p>
                  <p className="text-xs text-muted-foreground">{(li as any).unit === "hours" ? `${li.qty} ${li.qty === 1 ? "hr" : "hrs"}` : (li as any).unit === "days" ? `${li.qty} ${li.qty === 1 ? "day" : "days"}` : li.qty} × {formatGBP(li.unit_price)}{(li as any).unit === "hours" ? "/hr" : (li as any).unit === "days" ? "/day" : ""}</p>
                </div>
                <p className="num text-base">{formatGBP(li.qty * li.unit_price)}</p>
              </li>
            ))}
          </ul>

          <div className="px-5 py-4 bg-secondary/40 space-y-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="num">{formatGBP(quote.subtotal)}</span>
            </div>
            {quote.vat_amount > 0 && (
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">VAT (20%)</span>
                <span className="num">{formatGBP(quote.vat_amount)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-border">
              <span className="text-sm uppercase tracking-widest font-semibold">Total</span>
              <span className="num text-lg text-ink">{formatGBP(quote.total)}</span>
            </div>
            {depositPaid > 0 && (
              <>
                <div className="flex items-baseline justify-between text-sm pt-1">
                  <span className="text-muted-foreground">Less deposit paid</span>
                  <span className="num text-ink">−{formatGBP(depositPaid)}</span>
                </div>
                <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-border">
                  <span className="text-sm uppercase tracking-widest font-semibold">Balance due</span>
                  <span className="num text-3xl text-ink">{formatGBP(balance)}</span>
                </div>
              </>
            )}
          </div>

          <div className="px-5 py-3 bg-card">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Payment terms</p>
            <p className="text-xs text-ink font-semibold mt-1">{userProfile.payment_terms}</p>
          </div>
        </div>
      </section>

      {/* Send actions — grouped share trio */}
      {!isPaid && (
        <section className="px-5 mt-5 space-y-3">
          <div className="card-surface overflow-hidden divide-y divide-border">
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              onClick={() => { void markInvoiced(quote.id); }}
              className="w-full px-5 py-4 flex items-center gap-3 active:bg-secondary/60"
            >
              <MessageCircle className="h-5 w-5 text-ink" />
              <span className="font-semibold text-sm">Send invoice via WhatsApp</span>
            </a>
            <a
              href={mail}
              onClick={() => { void markInvoiced(quote.id); }}
              className="w-full px-5 py-4 flex items-center gap-3 active:bg-secondary/60"
            >
              <Mail className="h-5 w-5 text-ink" />
              <span className="font-semibold text-sm">Email invoice</span>
            </a>
            <button
              onClick={downloadPdf}
              className="w-full px-5 py-4 flex items-center gap-3 active:bg-secondary/60 text-left"
            >
              <Share2 className="h-5 w-5 text-ink" />
              <span className="font-semibold text-sm">Download / share PDF</span>
            </button>
          </div>

          <button
            onClick={async () => {
              try {
                await setQuoteStatus(quote.id, "paid");
                feedback("success");
                playSample("cash");
                toast.success("Paid. That's in the bank.");
                // Fire-and-forget branded email; status surfaces in the
                // "Paid" panel below after refresh.
                resendEmail({ data: { quoteId: quote.id } }).catch(() => {});
                router.invalidate();
              } catch (e) {
                feedback("error");
                toast.error(e instanceof Error ? e.message : "Couldn't mark as paid");
              }
            }}
            className="w-full bg-lime text-ink rounded-full py-4 font-bold inline-flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="h-5 w-5" /> Mark as paid (cash / bank)
          </button>
        </section>
      )}

      {isPaid && (
        <section className="px-5 mt-5 space-y-2.5">
          <div className="rounded-full bg-status-paid/15 text-status-paid font-bold inline-flex items-center justify-center gap-2 w-full py-4">
            <Check className="h-5 w-5" /> Paid
          </div>

          {/* Lightweight email-delivery status */}
          {emailStatus && (
            <div className="card-surface px-4 py-3 flex items-start gap-3">
              {emailStatus.invoice_email_status === "sent" ? (
                <>
                  <MailCheck className="h-5 w-5 text-status-paid shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">
                      Invoice emailed to {emailStatus.invoice_email_to || client?.email} ✓
                    </p>
                    {emailStatus.invoice_email_sent_at && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Sent {new Date(emailStatus.invoice_email_sent_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleResend}
                    disabled={resending}
                    className="text-xs font-semibold text-ink underline decoration-dotted underline-offset-2 disabled:opacity-50"
                  >
                    {resending ? "Sending…" : "Resend"}
                  </button>
                </>
              ) : emailStatus.invoice_email_status === "skipped" ? (
                <>
                  <MailWarning className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">No email on file</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Send the invoice link via WhatsApp instead.
                    </p>
                  </div>
                </>
              ) : emailStatus.invoice_email_status === "failed" ? (
                <>
                  <MailX className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">Email failed — try again</p>
                    {emailStatus.invoice_email_error && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {emailStatus.invoice_email_error}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleResend}
                    disabled={resending}
                    className="text-xs font-bold bg-ink text-paper rounded-full px-3 py-1.5 disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    {resending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    {resending ? "Sending…" : "Resend"}
                  </button>
                </>
              ) : (
                <>
                  <Mail className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">Send invoice by email</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {client?.email ? `We'll email a branded PDF to ${client.email}.` : "Add an email to the client to send a branded PDF."}
                    </p>
                  </div>
                  {client?.email && (
                    <button
                      onClick={handleResend}
                      disabled={resending}
                      className="text-xs font-bold bg-lime text-ink rounded-full px-3 py-1.5 disabled:opacity-50"
                    >
                      {resending ? "Sending…" : "Send"}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          <button
            onClick={downloadPdf}
            className="w-full bg-card border border-border text-ink rounded-full py-3.5 font-semibold inline-flex items-center justify-center gap-2 text-sm"
          >
            <Download className="h-4 w-4" /> Download PDF
          </button>
        </section>
      )}
    </AppShell>
  );
}

import { createFileRoute, notFound } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  getQuote, getClient, userProfile, formatGBP, waLink,
  invoiceRef, buildFinalInvoiceMessage, markInvoiced, setQuoteStatus,
} from "@/lib/user-data";
import { MessageCircle, Mail, Share2, CheckCircle2 } from "lucide-react";
import { QuottrLogo } from "@/components/QuottrLogo";
import { BusinessLogo } from "@/components/BusinessLogo";
import { downloadOrShareQuotePdf } from "@/lib/pdf";
import { toast } from "sonner";
import { feedback } from "@/lib/feedback";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getQuotePaymentStatus } from "@/lib/payments.functions";

export const Route = createFileRoute("/invoices/$quoteId")({
  component: InvoicePage,
  notFoundComponent: () => <div className="p-8 text-center">Invoice not found</div>,
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
    // Refetch when the tab regains focus or visibility — so a deposit recorded
    // on the quote screen is reflected when the user returns to this invoice.
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

  return (
    <AppShell>
      <PageHeader title="Final invoice" subtitle={ref} back={`/quotes/${quote.id}`} />

      {/* Bold INVOICE banner, distinct from quote */}
      <section className="px-5">
        <div className="rounded-3xl bg-ink text-paper overflow-hidden">
          <div className="px-6 pt-6 pb-5 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <BusinessLogo logoUrl={userProfile.logo_url} businessName={userProfile.business_name} size="md" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.3em] text-lime font-bold">Invoice</p>
                <h1 className="text-5xl mt-1 leading-none text-paper">{ref}</h1>
                <p className="text-xs text-paper/60 mt-2 truncate">{userProfile.business_name}</p>
                {(() => {
                  const parts = [
                    userProfile.registration_number,
                    userProfile.vat_registered && userProfile.vat_number ? `VAT ${userProfile.vat_number}` : null,
                  ].filter(Boolean);
                  return parts.length > 0 ? (
                    <p className="text-[10px] text-paper/50 truncate">
                      {parts.join(" · ")}
                    </p>
                  ) : null;
                })()}
              </div>
            </div>
            <QuottrLogo className="h-6 w-auto opacity-60" />
          </div>

          {/* Hero amount due */}
          <div className="px-6 pb-5">
            <p className="text-[10px] uppercase tracking-widest text-paper/60 font-bold">{depositPaid > 0 ? "Balance due" : "Amount due"}</p>
            <p className="num text-6xl text-lime leading-none mt-1">{formatGBP(balance)}</p>
            {dueDate && (
              <p className="text-xs text-paper/80 mt-2">
                Payment due by <span className="font-semibold text-paper">{dueDate}</span>
              </p>
            )}
          </div>

        </div>
      </section>


      {/* Billed to + job summary */}
      <section className="px-5 mt-4">
        <div className="card-surface p-5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Billed to</p>
          <p className="font-semibold mt-1">{client?.name}</p>
          <p className="text-xs text-muted-foreground">{client?.address}</p>
        </div>
      </section>

      <section className="px-5 mt-3">
        <div className="card-surface overflow-hidden">
          <div className="px-5 pt-4 pb-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">For</p>
            <p className="font-semibold text-base mt-1">{quote.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1">{quote.job_description}</p>
          </div>
          <ul className="mt-3">
            {quote.line_items.map((li, i) => (
              <li key={i} className="px-5 py-3 flex items-start gap-3 border-t border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{li.description}</p>
                  <p className="text-xs text-muted-foreground">{(li as any).unit === "hours" ? `${li.qty} ${li.qty === 1 ? "hr" : "hrs"}` : (li as any).unit === "days" ? `${li.qty} ${li.qty === 1 ? "day" : "days"}` : li.qty} × {formatGBP(li.unit_price)}{(li as any).unit === "hours" ? "/hr" : (li as any).unit === "days" ? "/day" : ""}</p>
                </div>
                <p className="num text-base">{formatGBP(li.qty * li.unit_price)}</p>
              </li>
            ))}
          </ul>
          <div className="px-5 py-4 border-t border-border bg-secondary/40 space-y-1.5">
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
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Less deposit paid</span>
                <span className="num text-ink">−{formatGBP(depositPaid)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-border">
              <span className="text-sm uppercase tracking-widest font-semibold">Balance due</span>
              <span className="num text-3xl text-ink">{formatGBP(balance)}</span>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-border bg-card">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Payment terms</p>
            <p className="text-xs text-ink font-semibold mt-1">{userProfile.payment_terms}</p>
          </div>
        </div>
      </section>

      {/* Send actions */}
      <section className="px-5 mt-5 space-y-2.5">
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          onClick={() => { void markInvoiced(quote.id); }}
          className="w-full bg-lime text-ink rounded-full py-4 font-bold inline-flex items-center justify-center gap-2"
        >
          <MessageCircle className="h-5 w-5" /> Send invoice via WhatsApp
        </a>
        <a
          href={mail}
          onClick={() => { void markInvoiced(quote.id); }}
          className="w-full bg-ink text-paper rounded-full py-3.5 font-semibold inline-flex items-center justify-center gap-2 text-sm"
        >
          <Mail className="h-4 w-4" /> Email invoice
        </a>
        <button
          onClick={async () => {
            try {
              await markInvoiced(quote.id);
              const r = await downloadOrShareQuotePdf(quote, client, "invoice");
              if (!r.shared && !r.cancelled) { feedback("success"); toast.success("Invoice PDF downloaded"); }
            } catch (e) {
              feedback("error"); toast.error(e instanceof Error ? e.message : "Could not generate PDF");
            }
          }}
          className="w-full bg-card border-2 border-ink text-ink rounded-full py-3.5 font-bold inline-flex items-center justify-center gap-2 text-sm"
        >
          <Share2 className="h-4 w-4" /> Download / share PDF
        </button>
        <button
          disabled={isPaid}
          onClick={async () => {
            try {
              await setQuoteStatus(quote.id, "paid");
              feedback("success");
              toast.success("Marked as paid");
              router.invalidate();
            } catch (e) {
              feedback("error");
              toast.error(e instanceof Error ? e.message : "Could not mark as paid");
            }
          }}
          className="w-full bg-card border-2 border-lime text-ink rounded-full py-3.5 font-bold inline-flex items-center justify-center gap-2 text-sm disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4 text-lime" /> {isPaid ? "Paid" : "Mark as paid (cash / bank)"}
        </button>
      </section>
    </AppShell>
  );
}

import { createFileRoute, notFound } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  getQuote, getClient, mockProfile, formatGBP,
  invoiceRef, buildFinalInvoiceMessage, stripePaymentLink, markInvoiced,
} from "@/lib/mock-data";
import { MessageCircle, Mail, CreditCard, Landmark } from "lucide-react";
import { QuottrLogo } from "@/components/QuottrLogo";

export const Route = createFileRoute("/invoices/$quoteId")({
  component: InvoicePage,
  notFoundComponent: () => <div className="p-8 text-center">Invoice not found</div>,
});

function InvoicePage() {
  const { quoteId } = Route.useParams();
  const quote = getQuote(quoteId);
  if (!quote) throw notFound();
  // Ensure invoice metadata exists if user lands here directly
  if (!quote.invoiced_at) markInvoiced(quote.id);
  const client = getClient(quote.client_id);
  const ref = invoiceRef(quote);
  const firstName = client?.name.split(" ")[0] ?? "there";
  const body = buildFinalInvoiceMessage(quote, firstName);
  const encoded = encodeURIComponent(body);
  const digits = client?.phone.replace(/\D/g, "");
  const wa = `https://wa.me/${digits ? "44" + digits.replace(/^0/, "") : ""}?text=${encoded}`;
  const mail = `mailto:${client?.email}?subject=${encodeURIComponent(`INVOICE ${ref} — ${mockProfile.business_name}`)}&body=${encoded}`;
  const cardLink = quote.payment_request?.link ?? stripePaymentLink(quote);
  const dueDate = quote.invoice_due_date
    ? new Date(quote.invoice_due_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <AppShell>
      <PageHeader title="Final invoice" subtitle={ref} back={`/quotes/${quote.id}`} />

      {/* Bold INVOICE banner — distinct from quote */}
      <section className="px-5">
        <div className="rounded-3xl bg-ink text-paper overflow-hidden">
          <div className="px-6 pt-6 pb-5 flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-lime font-bold">Invoice</p>
              <h1 className="text-5xl mt-1 leading-none text-paper">{ref}</h1>
              <p className="text-xs text-paper/60 mt-2">{mockProfile.business_name}</p>
              <p className="text-[10px] text-paper/50">{mockProfile.registration_number} · VAT {mockProfile.vat_number}</p>
            </div>
            <QuottrLogo className="h-8 w-auto" />
          </div>

          {/* Hero amount due */}
          <div className="px-6 pb-5">
            <p className="text-[10px] uppercase tracking-widest text-paper/60 font-bold">Amount due</p>
            <p className="num text-6xl text-lime leading-none mt-1">{formatGBP(quote.total)}</p>
            {dueDate && (
              <p className="text-xs text-paper/80 mt-2">
                Payment due by <span className="font-semibold text-paper">{dueDate}</span>
              </p>
            )}
          </div>

          {/* Prominent pay-by-card */}
          <div className="px-6 pb-6">
            <a
              href={cardLink}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-lime text-ink rounded-full py-4 font-bold inline-flex items-center justify-center gap-2 text-base"
            >
              <CreditCard className="h-5 w-5" /> Pay {formatGBP(quote.total)} by card
            </a>
            <p className="text-[10px] text-paper/50 text-center mt-2 break-all">{cardLink}</p>
          </div>

          {/* Bank details panel — always prominent on invoice */}
          <div className="bg-paper/5 px-6 py-4 border-t border-paper/10">
            <div className="flex items-center gap-2 mb-2">
              <Landmark className="h-4 w-4 text-lime" />
              <p className="text-[10px] uppercase tracking-widest text-paper/60 font-bold">Or pay by bank transfer</p>
            </div>
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs">
              <span className="text-paper/60">Account</span><span className="font-semibold text-paper">{mockProfile.bank_account_name}</span>
              <span className="text-paper/60">Bank</span><span className="font-semibold text-paper">{mockProfile.bank_name}</span>
              <span className="text-paper/60">Sort code</span><span className="num font-semibold text-paper">{mockProfile.sort_code}</span>
              <span className="text-paper/60">Account no.</span><span className="num font-semibold text-paper">{mockProfile.account_number}</span>
              <span className="text-paper/60">Reference</span><span className="font-bold text-lime">{ref}</span>
            </div>
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
                  <p className="text-xs text-muted-foreground">{li.qty} × {formatGBP(li.unit_price)}</p>
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
              <span className="text-sm uppercase tracking-widest font-semibold">Total due</span>
              <span className="num text-3xl text-ink">{formatGBP(quote.total)}</span>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-border bg-card">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Payment terms</p>
            <p className="text-xs text-muted-foreground mt-1">{mockProfile.payment_terms}</p>
          </div>
        </div>
      </section>

      {/* Send actions */}
      <section className="px-5 mt-5 space-y-2.5">
        <a href={wa} target="_blank" rel="noreferrer" className="w-full bg-lime text-ink rounded-full py-4 font-bold inline-flex items-center justify-center gap-2">
          <MessageCircle className="h-5 w-5" /> Send invoice via WhatsApp
        </a>
        <a href={mail} className="w-full bg-ink text-paper rounded-full py-3.5 font-semibold inline-flex items-center justify-center gap-2 text-sm">
          <Mail className="h-4 w-4" /> Email invoice
        </a>
      </section>
    </AppShell>
  );
}

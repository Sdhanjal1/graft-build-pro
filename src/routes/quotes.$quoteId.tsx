import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { getQuote, getClient, mockProfile, formatGBP } from "@/lib/mock-data";
import { MessageCircle, Mail, Phone, Pencil } from "lucide-react";

export const Route = createFileRoute("/quotes/$quoteId")({
  component: QuoteDetail,
  notFoundComponent: () => <div className="p-8 text-center">Quote not found</div>,
});

function QuoteDetail() {
  const { quoteId } = Route.useParams();
  const quote = getQuote(quoteId);
  if (!quote) throw notFound();
  const client = getClient(quote.client_id);

  const whatsappBody = encodeURIComponent(
    `Hi ${client?.name.split(" ")[0]}, here's your quote ${quote.ref} for "${quote.title}" — total ${formatGBP(quote.total)}. Reply to accept. Thanks, ${mockProfile.full_name} (${mockProfile.business_name}).`,
  );
  const phoneDigits = client?.phone.replace(/\D/g, "");
  const waHref = `https://wa.me/${phoneDigits ? "44" + phoneDigits.replace(/^0/, "") : ""}?text=${whatsappBody}`;
  const mailHref = `mailto:${client?.email}?subject=${encodeURIComponent(`Quote ${quote.ref} — ${quote.title}`)}&body=${whatsappBody}`;

  return (
    <AppShell>
      <PageHeader title={quote.title} subtitle={quote.ref} back="/quotes" right={<StatusBadge status={quote.status} />} />

      {/* Client */}
      {client && (
        <section className="px-5">
          <Link
            to="/clients/$clientId"
            params={{ clientId: client.id }}
            className="card-surface p-4 flex items-center gap-3"
          >
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

      {/* Job */}
      <section className="px-5 mt-4">
        <div className="card-surface p-5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Job description</p>
          <p className="text-sm mt-2 leading-relaxed">{quote.job_description}</p>
        </div>
      </section>

      {/* Line items */}
      <section className="px-5 mt-4">
        <div className="card-surface overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Itemised</p>
          </div>
          <ul>
            {quote.line_items.map((li, i) => (
              <li key={i} className="px-5 py-3 flex items-start gap-3 border-t border-border first:border-t-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{li.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {li.qty} × {formatGBP(li.unit_price)}
                  </p>
                </div>
                <p className="num text-base">{formatGBP(li.qty * li.unit_price)}</p>
              </li>
            ))}
          </ul>
          <div className="px-5 py-4 border-t border-border bg-secondary/40 space-y-1.5">
            <Row label="Subtotal" value={formatGBP(quote.subtotal)} />
            <Row label="VAT (20%)" value={formatGBP(quote.vat_amount)} />
            <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-border">
              <span className="text-sm uppercase tracking-widest font-semibold">Total</span>
              <span className="num text-3xl text-ink">{formatGBP(quote.total)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Actions */}
      <section className="px-5 mt-5 space-y-2.5">
        <a
          href={waHref}
          target="_blank"
          rel="noreferrer"
          className="w-full bg-lime text-ink rounded-full py-4 font-bold inline-flex items-center justify-center gap-2"
        >
          <MessageCircle className="h-5 w-5" />
          Send via WhatsApp
        </a>
        <div className="grid grid-cols-2 gap-2.5">
          <a
            href={mailHref}
            className="bg-ink text-paper rounded-full py-3.5 font-semibold inline-flex items-center justify-center gap-2 text-sm"
          >
            <Mail className="h-4 w-4" />
            Email
          </a>
          <a
            href={`tel:${client?.phone}`}
            className="bg-card border border-border text-ink rounded-full py-3.5 font-semibold inline-flex items-center justify-center gap-2 text-sm"
          >
            <Phone className="h-4 w-4" />
            Call
          </a>
        </div>
        <button className="w-full bg-card border border-border text-ink rounded-full py-3.5 font-semibold inline-flex items-center justify-center gap-2 text-sm">
          <Pencil className="h-4 w-4" />
          Update status
        </button>
      </section>
    </AppShell>
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

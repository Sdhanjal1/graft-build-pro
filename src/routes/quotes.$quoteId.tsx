import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import {
  getQuote, getClient, mockProfile, formatGBP,
  buildInvoiceMessage, stripePaymentLink,
  type PaymentMethod, type Quote,
} from "@/lib/mock-data";
import { MessageCircle, Mail, Phone, CreditCard, Landmark, Banknote, Check, CheckCircle2 } from "lucide-react";

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

  const setMethod = (m: PaymentMethod) => { quote.payment_method = m; setMethodState(m); };
  const markPaid = (m: PaymentMethod) => {
    quote.paid_via = m; quote.status = "paid";
    setPaidViaState(m); setStatusState("paid"); setAskingPaid(false);
  };

  const liveQuote: Quote = { ...quote, payment_method: method, status, paid_via: paidVia };
  const messageBody = buildInvoiceMessage(liveQuote, client?.name.split(" ")[0] ?? "there");
  const encoded = encodeURIComponent(messageBody);
  const phoneDigits = client?.phone.replace(/\D/g, "");
  const waHref = `https://wa.me/${phoneDigits ? "44" + phoneDigits.replace(/^0/, "") : ""}?text=${encoded}`;
  const mailHref = `mailto:${client?.email}?subject=${encodeURIComponent(`Invoice ${quote.ref} — ${quote.title}`)}&body=${encoded}`;

  return (
    <AppShell>
      <PageHeader title={quote.title} subtitle={quote.ref} back="/quotes" right={<StatusBadge status={status} />} />

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
          <ul>
            {quote.line_items.map((li, i) => (
              <li key={i} className="px-5 py-3 flex items-start gap-3 border-t border-border first:border-t-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{li.description}</p>
                  <p className="text-xs text-muted-foreground">{li.qty} × {formatGBP(li.unit_price)}</p>
                </div>
                <p className="num text-base">{formatGBP(li.qty * li.unit_price)}</p>
              </li>
            ))}
          </ul>
          <div className="px-5 py-4 border-t border-border bg-secondary/40 space-y-1.5">
            <Row label="Subtotal" value={formatGBP(quote.subtotal)} />
            {mockProfile.vat_registered && <Row label="VAT (20%)" value={formatGBP(quote.vat_amount)} />}
            <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-border">
              <span className="text-sm uppercase tracking-widest font-semibold">Total</span>
              <span className="num text-3xl text-ink">{formatGBP(quote.total)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Payment method selector */}
      <section className="px-5 mt-5">
        <h2 className="text-xl mb-2.5">Payment method</h2>
        <div className="card-surface p-2 space-y-1.5">
          <MethodOption
            active={method === "card"} onClick={() => setMethod("card")}
            icon={CreditCard} label="Pay by card online"
            sub={mockProfile.stripe_connected ? "Stripe link auto-included" : "Stripe (test link) — connect Stripe in Settings to go live"}
          />
          <MethodOption
            active={method === "bank"} onClick={() => setMethod("bank")}
            icon={Landmark} label="Pay by bank transfer"
            sub={`${mockProfile.bank_name} · sort ${mockProfile.sort_code}`}
          />
          <MethodOption
            active={method === "cash"} onClick={() => setMethod("cash")}
            icon={Banknote} label="Cash on completion"
            sub="Customer brings cash on the day"
          />
        </div>

        {method === "card" && (
          <div className="mt-3 rounded-2xl bg-ink text-paper p-4">
            <p className="text-[10px] uppercase tracking-widest text-paper/60 font-semibold">Stripe payment link</p>
            <p className="text-xs mt-1 break-all text-lime">{stripePaymentLink(liveQuote)}</p>
          </div>
        )}
        {method === "bank" && (
          <div className="mt-3 card-surface p-4 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Bank details on invoice</p>
            <BankRow k="Account name" v={mockProfile.bank_account_name} />
            <BankRow k="Bank" v={mockProfile.bank_name} />
            <BankRow k="Sort code" v={mockProfile.sort_code} />
            <BankRow k="Account no." v={mockProfile.account_number} />
            <BankRow k="Reference" v={quote.ref} />
          </div>
        )}
        {method === "cash" && (
          <div className="mt-3 card-surface p-4">
            <p className="text-sm"><span className="font-semibold">Payment method:</span> Cash on completion — please have cash ready on the day.</p>
          </div>
        )}
      </section>

      {/* Actions */}
      <section className="px-5 mt-5 space-y-2.5">
        <a href={waHref} target="_blank" rel="noreferrer" className="w-full bg-lime text-ink rounded-full py-4 font-bold inline-flex items-center justify-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Send via WhatsApp
        </a>
        <div className="grid grid-cols-2 gap-2.5">
          <a href={mailHref} className="bg-ink text-paper rounded-full py-3.5 font-semibold inline-flex items-center justify-center gap-2 text-sm">
            <Mail className="h-4 w-4" /> Email
          </a>
          <a href={`tel:${client?.phone}`} className="bg-card border border-border text-ink rounded-full py-3.5 font-semibold inline-flex items-center justify-center gap-2 text-sm">
            <Phone className="h-4 w-4" /> Call
          </a>
        </div>

        {status !== "paid" ? (
          <button
            onClick={() => setAskingPaid(true)}
            className="w-full bg-card border-2 border-lime text-ink rounded-full py-3.5 font-bold inline-flex items-center justify-center gap-2 text-sm"
          >
            <Check className="h-4 w-4" /> Mark job complete
          </button>
        ) : (
          <div className="w-full bg-status-paid/15 border border-status-paid/40 rounded-2xl py-3.5 px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-ink">
            <CheckCircle2 className="h-4 w-4" />
            Paid via {paidVia === "card" ? "card" : paidVia === "bank" ? "bank transfer" : "cash"}
          </div>
        )}
      </section>

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

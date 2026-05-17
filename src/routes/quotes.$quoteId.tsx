import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import {
  getQuote, getClient, mockProfile, formatGBP,
  buildInvoiceMessage, stripePaymentLink, buildPaymentRequest,
  scheduleJob, getJobByQuote, formatDayLabel, formatTime,
  type PaymentMethod, type PaymentRequest, type PaymentRequestType, type Quote,
} from "@/lib/mock-data";
import { createInvoiceCheckout } from "@/lib/payments.functions";
import { MessageCircle, Mail, Phone, CreditCard, Landmark, Banknote, Check, CheckCircle2, Zap, Loader2, Calendar, ThumbsUp } from "lucide-react";
import { QuottrLogo } from "@/components/QuottrLogo";

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
  const [scheduling, setScheduling] = useState(false);
  const [job, setJob] = useState(() => getJobByQuote(quote.id));
  const defaultSchedule = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
    // Format for <input type="datetime-local">: yyyy-MM-ddTHH:mm
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);
  const [schedAt, setSchedAt] = useState(defaultSchedule);
  const [schedHrs, setSchedHrs] = useState("4");

  const createCheckout = useServerFn(createInvoiceCheckout);

  const setMethod = (m: PaymentMethod) => { quote.payment_method = m; setMethodState(m); };
  const acceptQuote = () => {
    quote.status = "accepted";
    setStatusState("accepted");
    setScheduling(true);
  };
  const confirmSchedule = () => {
    const iso = new Date(schedAt).toISOString();
    const hours = Math.max(0.5, Number(schedHrs) || 4);
    const j = scheduleJob(quote.id, iso, Math.round(hours * 60));
    setJob(j);
    setScheduling(false);
  };
  const markPaid = (m: PaymentMethod) => {
    quote.paid_via = m; quote.status = "paid";
    setPaidViaState(m); setStatusState("paid"); setAskingPaid(false);
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

  const liveQuote: Quote = { ...quote, payment_method: method, status, paid_via: paidVia, payment_request: paymentRequest };
  const messageBody = buildInvoiceMessage(liveQuote, client?.name.split(" ")[0] ?? "there");
  const encoded = encodeURIComponent(messageBody);
  const phoneDigits = client?.phone.replace(/\D/g, "");
  const waHref = `https://wa.me/${phoneDigits ? "44" + phoneDigits.replace(/^0/, "") : ""}?text=${encoded}`;
  const mailHref = `mailto:${client?.email}?subject=${encodeURIComponent(`Invoice ${quote.ref} — ${quote.title}`)}&body=${encoded}`;

  return (
    <AppShell>
      <div className="bg-ink text-paper px-5 pt-6 pb-5 flex items-center gap-3">
        <QuottrLogo className="h-7 w-auto" />
        <div className="h-6 w-px bg-paper/20" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-paper truncate">{mockProfile.business_name}</p>
          <p className="text-[10px] text-paper/60 truncate">{mockProfile.registration_number} · VAT {mockProfile.vat_number}</p>
        </div>
      </div>
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
            {method === "card" && (
              <Row label="Card processing fee (3.5%)" value={formatGBP(quote.total * 0.035)} muted />
            )}
            <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-border">
              <span className="text-sm uppercase tracking-widest font-semibold">
                {method === "card" ? "Total with card fee" : "Total"}
              </span>
              <span className="num text-3xl text-ink">
                {formatGBP(method === "card" ? quote.total * 1.035 : quote.total)}
              </span>
            </div>
            {method !== "card" && (
              <p className="text-[10px] text-muted-foreground pt-1">No fees for bank transfer or cash.</p>
            )}
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
          <div className="mt-3 rounded-2xl bg-ink text-paper p-4 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-paper/60 font-semibold">
              Stripe payment link {paymentRequest ? `· ${paymentRequest.label}` : ""}
            </p>
            <p className="text-xs break-all text-lime">
              {paymentRequest ? paymentRequest.link : stripePaymentLink(liveQuote)}
            </p>
            {paymentRequest && (
              <p className="num text-2xl text-paper">{formatGBP(paymentRequest.amount)}</p>
            )}
            {!mockProfile.stripe_connected && (
              <p className="text-[10px] text-paper/50">Test link — add your Stripe keys in Settings to go live.</p>
            )}
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

        {/* Accept (pending) */}
        {status === "pending" && (
          <button
            onClick={acceptQuote}
            className="w-full bg-lime text-ink rounded-full py-3.5 font-bold inline-flex items-center justify-center gap-2 text-sm"
          >
            <ThumbsUp className="h-4 w-4" /> Mark as accepted
          </button>
        )}

        {/* Scheduled summary or schedule prompt */}
        {status === "accepted" && (
          job ? (
            <Link
              to="/calendar"
              className="w-full bg-card border border-border rounded-2xl py-3 px-4 flex items-center gap-3 text-sm font-semibold"
            >
              <Calendar className="h-4 w-4 text-lime" />
              <span className="flex-1 truncate">
                Scheduled · {formatDayLabel(new Date(job.starts_at))} at {formatTime(job.starts_at)}
              </span>
              <button
                onClick={(e) => { e.preventDefault(); setScheduling(true); }}
                className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground"
              >
                Change
              </button>
            </Link>
          ) : (
            <button
              onClick={() => setScheduling(true)}
              className="w-full bg-card border-2 border-lime text-ink rounded-full py-3.5 font-bold inline-flex items-center justify-center gap-2 text-sm"
            >
              <Calendar className="h-4 w-4" /> Schedule this job
            </button>
          )
        )}

        {status !== "paid" && status === "accepted" && (
          <button
            onClick={() => setRequesting(true)}
            className="w-full bg-lime text-ink rounded-full py-3.5 font-bold inline-flex items-center justify-center gap-2 text-sm"
          >
            <Zap className="h-4 w-4" /> Request payment
          </button>
        )}

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
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={customAmt}
                      onChange={(e) => setCustomAmt(e.target.value)}
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

      {/* Bottom sheet: schedule this job */}
      {scheduling && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/60" onClick={() => setScheduling(false)}>
          <div className="w-full max-w-md mx-auto bg-paper rounded-t-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="h-1 w-10 bg-ink/20 rounded-full mx-auto mb-4" />
            <h3 className="text-2xl">Schedule this job?</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Pop it in your calendar so you don't forget. We'll remind you the day before.
            </p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Date & time</span>
                <input
                  type="datetime-local"
                  value={schedAt}
                  onChange={(e) => setSchedAt(e.target.value)}
                  className="mt-1 w-full bg-secondary rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-lime/40 font-medium"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Estimated duration (hours)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.5"
                  step="0.5"
                  value={schedHrs}
                  onChange={(e) => setSchedHrs(e.target.value)}
                  className="mt-1 w-full bg-secondary rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-lime/40 font-medium num"
                />
              </label>
            </div>
            <button
              onClick={confirmSchedule}
              className="w-full mt-4 bg-lime text-ink rounded-full py-3.5 font-bold text-sm inline-flex items-center justify-center gap-2"
            >
              <Calendar className="h-4 w-4" /> Add to calendar
            </button>
            <button onClick={() => setScheduling(false)} className="w-full mt-2 text-sm text-muted-foreground py-2">
              Not now
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

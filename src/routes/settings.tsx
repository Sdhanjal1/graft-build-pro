import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { mockProfile, stats, formatGBP } from "@/lib/mock-data";
import {
  Building2, User, Phone, Mail, BadgeCheck, Receipt, Key, LogOut, BarChart3,
  CreditCard, Landmark, Banknote, Wallet,
} from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const s = stats();
  const [vatRegistered, setVatRegistered] = useState(mockProfile.vat_registered);
  const [bank, setBank] = useState({
    account_name: mockProfile.bank_account_name,
    bank_name: mockProfile.bank_name,
    sort_code: mockProfile.sort_code,
    account_number: mockProfile.account_number,
    payment_reference_note: mockProfile.payment_reference_note,
  });
  const saveBank = (patch: Partial<typeof bank>) => {
    const next = { ...bank, ...patch };
    setBank(next);
    mockProfile.bank_account_name = next.account_name;
    mockProfile.bank_name = next.bank_name;
    mockProfile.sort_code = next.sort_code;
    mockProfile.account_number = next.account_number;
    mockProfile.payment_reference_note = next.payment_reference_note;
  };
  const [stripe, setStripe] = useState({
    publishable: mockProfile.stripe_publishable_key,
    secret: mockProfile.stripe_secret_key,
  });
  const saveStripe = (patch: Partial<typeof stripe>) => {
    const next = { ...stripe, ...patch };
    setStripe(next);
    mockProfile.stripe_publishable_key = next.publishable;
    mockProfile.stripe_secret_key = next.secret;
    mockProfile.stripe_connected = !!(next.publishable && next.secret);
  };
  const [terms, setTerms] = useState(mockProfile.payment_terms);
  const saveTerms = (v: string) => { setTerms(v); mockProfile.payment_terms = v; };

  return (
    <AppShell>
      <PageHeader title="Settings" subtitle="Account" />

      {/* Profit tracker */}
      <section className="px-5">
        <div className="card-surface p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4" />
            <p className="text-sm font-semibold">Profit tracker</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <BigStat label="Received" value={formatGBP(s.paid)} accent />
            <BigStat label="Outstanding" value={formatGBP(s.outstanding)} />
          </div>

          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
            Received by method
          </p>
          <div className="space-y-2">
            <MethodBar icon={CreditCard} label="Card" value={s.paidByCard} total={s.paid} />
            <MethodBar icon={Landmark} label="Bank transfer" value={s.paidByBank} total={s.paid} />
            <MethodBar icon={Banknote} label="Cash" value={s.paidByCash} total={s.paid} />
          </div>
        </div>
      </section>

      {/* Payment details */}
      <section className="px-5 mt-5">
        <h2 className="text-xl mb-2.5">Payment details</h2>
        <div className="card-surface p-5 space-y-4">
          {/* Stripe */}
          <div className="rounded-2xl bg-ink text-paper p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-lime text-ink flex items-center justify-center">
                <CreditCard className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">Stripe — card payments</p>
                <p className="text-[11px] text-paper/60">
                  {mockProfile.stripe_connected ? "Connected — live links" : "Add keys to generate live payment links"}
                </p>
              </div>
            </div>
            <DarkInput
              label="Publishable key"
              placeholder="pk_live_…"
              value={stripe.publishable}
              onChange={(v) => saveStripe({ publishable: v })}
            />
            <DarkInput
              label="Secret key"
              placeholder="sk_live_…"
              value={stripe.secret}
              onChange={(v) => saveStripe({ secret: v })}
              type="password"
            />
            <a
              href="https://stripe.com/docs/connect/onboarding"
              target="_blank"
              rel="noreferrer"
              className="block text-center w-full bg-lime text-ink rounded-full py-3 text-sm font-bold"
            >
              Connect Stripe account
            </a>
          </div>

          {/* Payment terms */}
          <div>
            <Input
              label="Payment terms (shown on every invoice)"
              value={terms}
              onChange={saveTerms}
            />
          </div>

          {/* Bank */}
          <div className="space-y-2.5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Bank transfer details</p>
            <Input label="Account name" value={bank.account_name} onChange={(v) => saveBank({ account_name: v })} />
            <Input label="Bank name" value={bank.bank_name} onChange={(v) => saveBank({ bank_name: v })} />
            <div className="grid grid-cols-2 gap-2.5">
              <Input label="Sort code" value={bank.sort_code} onChange={(v) => saveBank({ sort_code: v })} />
              <Input label="Account number" value={bank.account_number} onChange={(v) => saveBank({ account_number: v })} />
            </div>
            <Input
              label="Payment reference instructions"
              value={bank.payment_reference_note}
              onChange={(v) => saveBank({ payment_reference_note: v })}
            />
          </div>

          {/* VAT toggle */}
          <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-border">
            <div>
              <p className="font-semibold text-sm">VAT registered</p>
              <p className="text-xs text-muted-foreground">Adds 20% VAT to every quote</p>
            </div>
            <input
              type="checkbox"
              checked={vatRegistered}
              onChange={(e) => { setVatRegistered(e.target.checked); mockProfile.vat_registered = e.target.checked; }}
              className="h-6 w-11 appearance-none rounded-full bg-secondary checked:bg-lime relative cursor-pointer transition
                before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition
                checked:before:translate-x-5"
            />
          </label>
        </div>
      </section>

      {/* Business profile */}
      <section className="px-5 mt-5">
        <h2 className="text-xl mb-2.5">Business details</h2>
        <div className="card-surface p-5 space-y-3.5">
          <Field icon={Building2} label="Business name" value={mockProfile.business_name} />
          <Field icon={User} label="Your name" value={mockProfile.full_name} />
          <Field icon={Phone} label="Phone" value={mockProfile.phone} />
          <Field icon={Mail} label="Email" value={mockProfile.email} />
          <Field icon={BadgeCheck} label="Trade" value={mockProfile.trade_type} />
          <Field icon={BadgeCheck} label="Registration" value={mockProfile.registration_number} />
          <Field icon={Receipt} label="VAT number" value={mockProfile.vat_number} />
        </div>
      </section>

      <section className="px-5 mt-5">
        <h2 className="text-xl mb-2.5">Integrations</h2>
        <div className="card-surface divide-y divide-border">
          <SettingRow icon={Wallet} label="Stripe Connect" status={mockProfile.stripe_connected ? "Connected" : "Add to take card payments"} />
          <SettingRow icon={Key} label="Claude API key" status="Add to enable AI quotes" />
          <SettingRow icon={Key} label="OpenAI Whisper key" status="Add to enable voice-to-text" />
        </div>
      </section>

      <section className="px-5 mt-5 mb-6">
        <Link to="/auth" className="card-surface p-4 flex items-center gap-3 text-status-overdue font-semibold">
          <LogOut className="h-5 w-5" />
          Sign out
        </Link>
      </section>
    </AppShell>
  );
}

function Field({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-secondary rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-lime/40 font-medium"
      />
    </label>
  );
}

function DarkInput({
  label, value, onChange, placeholder, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-paper/60 font-semibold">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-paper/10 text-paper placeholder:text-paper/40 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-lime/40 font-medium"
      />
    </label>
  );
}

function BigStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${accent ? "bg-lime text-ink" : "bg-secondary"}`}>
      <p className="text-[10px] uppercase tracking-widest font-semibold opacity-70">{label}</p>
      <p className="num text-2xl mt-1">{value}</p>
    </div>
  );
}

function MethodBar({
  icon: Icon, label, value, total,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; total: number }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="inline-flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className="num font-semibold">{formatGBP(value)}</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-lime rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SettingRow({ icon: Icon, label, status }: { icon: React.ComponentType<{ className?: string }>; label: string; status: string }) {
  return (
    <div className="px-5 py-4 flex items-center gap-3">
      <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{status}</p>
      </div>
      <span className="text-xs font-semibold text-ink bg-lime px-3 py-1.5 rounded-full">Add</span>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { mockProfile, stats, formatGBP, TRADE_TYPES } from "@/lib/mock-data";
import {
  Building2, User, Phone, Mail, BadgeCheck, Receipt, Key, LogOut, BarChart3,
  CreditCard, Landmark, Banknote, Wallet, Trophy, MapPin, Gift, Share2,
} from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const s = stats();

  // --- Business profile (editable) ---
  const [profile, setProfile] = useState({
    business_name: mockProfile.business_name,
    full_name: mockProfile.full_name,
    phone: mockProfile.phone,
    email: mockProfile.email,
    town: mockProfile.town,
    trade_type: mockProfile.trade_type,
    registration_number: mockProfile.registration_number,
    vat_number: mockProfile.vat_number,
  });
  const saveProfile = (patch: Partial<typeof profile>) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    Object.assign(mockProfile, next);
  };

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

  const topMax = s.topJobs[0]?.total ?? 1;

  return (
    <AppShell>
      <PageHeader title="Settings" subtitle="Account" />

      {/* Profit tracker */}
      <section className="px-5">
        <div className="card-surface p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4" />
            <p className="text-sm font-semibold">Profit tracker</p>
            <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <BigStat label="Quoted" value={formatGBP(s.totalQuoted)} />
            <BigStat label="Collected" value={formatGBP(s.collectedAll)} accent />
            <BigStat label="Outstanding" value={formatGBP(s.outstanding)} />
          </div>

          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
            Received by method
          </p>
          <div className="space-y-2">
            <MethodBar icon={CreditCard} label="Card"          value={s.paidByCard} total={s.collectedAll} />
            <MethodBar icon={Landmark}   label="Bank transfer" value={s.paidByBank} total={s.collectedAll} />
            <MethodBar icon={Banknote}   label="Cash"          value={s.paidByCash} total={s.collectedAll} />
          </div>

          {/* Best performing job */}
          {s.bestJob && (
            <div className="mt-4 rounded-2xl bg-lime text-ink p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-ink text-lime flex items-center justify-center shrink-0">
                <Trophy className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-widest font-bold opacity-70">Best performing job</p>
                <p className="text-sm font-semibold truncate">{s.bestJob.title}</p>
              </div>
              <p className="num text-2xl shrink-0">{formatGBP(s.bestJob.total)}</p>
            </div>
          )}

          {/* Top 5 by value */}
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mt-4 mb-2">
            Top 5 jobs by value
          </p>
          <div className="space-y-2">
            {s.topJobs.map((q) => (
              <div key={q.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="truncate pr-2 font-medium">{q.title}</span>
                  <span className="num font-semibold shrink-0">{formatGBP(q.total)}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-ink rounded-full" style={{ width: `${(q.total / topMax) * 100}%` }} />
                </div>
              </div>
            ))}
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
          <Input label="Payment terms (shown on every invoice)" value={terms} onChange={saveTerms} />

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

      {/* Business profile — editable */}
      <section className="px-5 mt-5">
        <h2 className="text-xl mb-2.5">Business details</h2>
        <div className="card-surface p-5 space-y-3.5">
          <EditField icon={Building2} label="Business name"   value={profile.business_name}        onChange={(v) => saveProfile({ business_name: v })} />
          <EditField icon={User}      label="Your name"        value={profile.full_name}            onChange={(v) => saveProfile({ full_name: v })} />
          <EditField icon={Phone}     label="Phone"            value={profile.phone}                onChange={(v) => saveProfile({ phone: v })} />
          <EditField icon={Mail}      label="Email"            value={profile.email}                onChange={(v) => saveProfile({ email: v })} />
          <EditField icon={MapPin}    label="Town"             value={profile.town}                 onChange={(v) => saveProfile({ town: v })} placeholder="e.g. Manchester" />
          <SelectField icon={BadgeCheck} label="Trade type"    value={profile.trade_type}           onChange={(v) => saveProfile({ trade_type: v })} options={TRADE_TYPES} />
          <EditField icon={BadgeCheck} label="Gas Safe registration"  value={profile.registration_number}  onChange={(v) => saveProfile({ registration_number: v })} />
          <EditField icon={Receipt}    label="VAT number"      value={profile.vat_number}           onChange={(v) => saveProfile({ vat_number: v })} />
        </div>
      </section>

      <section className="px-5 mt-5">
        <h2 className="text-xl mb-2.5">Integrations</h2>
        <div className="card-surface divide-y divide-border">
          <SettingRow icon={Wallet} label="Stripe Connect" status={mockProfile.stripe_connected ? "Connected" : "Add to take card payments"} />
          <SettingRow icon={Key} label="Claude API key" status="Optional — fallback quote generator is active" />
          <SettingRow icon={Key} label="OpenAI Whisper key" status="Add to enable voice-to-text" />
        </div>
      </section>

      <section className="px-5 mt-5">
        <ReferMate />
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

function EditField({
  icon: Icon, label, value, onChange, placeholder,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <label className="min-w-0 flex-1 block">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="mt-0.5 w-full bg-transparent outline-none text-sm font-medium border-b border-transparent focus:border-ink/30 py-0.5"
        />
      </label>
    </div>
  );
}

function SelectField({
  icon: Icon, label, value, onChange, options,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <label className="min-w-0 flex-1 block">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-0.5 w-full bg-transparent outline-none text-sm font-medium border-b border-transparent focus:border-ink/30 py-0.5"
        >
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
      </label>
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
    <div className={`rounded-2xl p-3 ${accent ? "bg-lime text-ink" : "bg-secondary"}`}>
      <p className="text-[9px] uppercase tracking-widest font-semibold opacity-70">{label}</p>
      <p className="num text-lg mt-1 leading-none">{value}</p>
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

function ReferMate() {
  const code = "MATE20";
  const shareText =
    `I use Quottr to quote on the spot and get paid faster — try it. ` +
    `Use my code ${code} for £20 off your first month: https://quottr.app/?ref=${code}`;
  const onShare = async () => {
    if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
          title: "Quottr",
          text: shareText,
        });
        return;
      } catch {
        // fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      alert("Share message copied to clipboard");
    } catch {
      // no-op
    }
  };
  return (
    <div className="rounded-2xl bg-ink text-paper p-5 relative overflow-hidden">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-lime/30 blur-2xl" />
      <div className="flex items-center gap-2">
        <Gift className="h-4 w-4 text-lime" />
        <p className="text-xs uppercase tracking-widest text-paper/60 font-semibold">Refer a mate</p>
      </div>
      <h3 className="text-2xl mt-1 leading-tight">Give £20 off, get £20 off</h3>
      <p className="text-xs text-paper/70 mt-1">Share Quottr with another tradesperson — when they sign up you both get £20 off your next month.</p>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 bg-paper/10 rounded-full px-4 py-2.5">
          <p className="text-[10px] uppercase tracking-widest text-paper/50 font-semibold">Your code</p>
          <p className="num text-base text-lime leading-none">{code}</p>
        </div>
        <button
          onClick={onShare}
          className="bg-lime text-ink rounded-full px-4 py-3 text-sm font-bold inline-flex items-center gap-2"
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
      </div>
    </div>
  );
}

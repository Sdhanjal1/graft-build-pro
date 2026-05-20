import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  mockProfile,
  TRADE_TYPES,
  clearUserData,
  saveProfileToCloud,
} from "@/lib/mock-data";
import { signOut } from "@/lib/auth";
import { getFeedbackPrefs, setFeedbackPrefs, feedback } from "@/lib/feedback";
import {
  Building2, User, Phone, Mail, BadgeCheck, Receipt, Key, LogOut,
  CreditCard, MapPin, Gift, Share2, Vibrate, Volume2, Clock,
  CheckCircle2, FileText, MessageSquare, AlertTriangle, Trash2, Bell,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getWorkingHours, saveWorkingHours, type WorkingHours } from "@/lib/working-hours.functions";
import { CustomerQRCard, PushPermissionCard } from "@/components/CustomerQRCard";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const handleSignOut = async () => {
    await signOut();
    clearUserData();
    navigate({ to: "/auth" });
  };

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
  const saveProfile = (patch: Partial<typeof profile>) => setProfile((p) => ({ ...p, ...patch }));

  const [vatRegistered, setVatRegistered] = useState(mockProfile.vat_registered);
  const [bank, setBank] = useState({
    account_name: mockProfile.bank_account_name,
    bank_name: mockProfile.bank_name,
    sort_code: mockProfile.sort_code,
    account_number: mockProfile.account_number,
    payment_reference_note: mockProfile.payment_reference_note,
  });
  const [stripe, setStripe] = useState({
    publishable: mockProfile.stripe_publishable_key,
    secret: mockProfile.stripe_secret_key,
  });
  const [terms, setTerms] = useState(mockProfile.payment_terms);

  // Debounced cloud-save
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveProfileToCloud({
        ...profile,
        vat_registered: vatRegistered,
        bank_account_name: bank.account_name,
        bank_name: bank.bank_name,
        sort_code: bank.sort_code,
        account_number: bank.account_number,
        payment_reference_note: bank.payment_reference_note,
        stripe_publishable_key: stripe.publishable,
        stripe_secret_key: stripe.secret,
        stripe_connected: !!(stripe.publishable && stripe.secret),
        payment_terms: terms,
      });
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, vatRegistered, bank, stripe, terms]);

  const saveBank = (patch: Partial<typeof bank>) => setBank((b) => ({ ...b, ...patch }));
  const saveStripe = (patch: Partial<typeof stripe>) => setStripe((s) => ({ ...s, ...patch }));

  const stripeConnected = !!(stripe.publishable && stripe.secret);

  return (
    <AppShell>
      <PageHeader title="Settings" subtitle="Configuration" />

      {/* BUSINESS */}
      <Section title="Business">
        <div className="card-surface p-5 space-y-3.5">
          <EditField icon={Building2}  label="Business name" value={profile.business_name} onChange={(v) => saveProfile({ business_name: v })} />
          <EditField icon={User}       label="Your name"     value={profile.full_name}     onChange={(v) => saveProfile({ full_name: v })} />
          <EditField icon={Phone}      label="Phone"         value={profile.phone}         onChange={(v) => saveProfile({ phone: v })} />
          <EditField icon={Mail}       label="Email"         value={profile.email}         onChange={(v) => saveProfile({ email: v })} />
          <EditField icon={MapPin}     label="Town"          value={profile.town}          onChange={(v) => saveProfile({ town: v })} placeholder="e.g. Manchester" />
          <SelectField icon={BadgeCheck} label="Trade type"  value={profile.trade_type}    onChange={(v) => saveProfile({ trade_type: v })} options={TRADE_TYPES} />
          <EditField icon={BadgeCheck} label="Gas Safe registration number" value={profile.registration_number} onChange={(v) => saveProfile({ registration_number: v })} />
          <EditField icon={Receipt}    label="VAT number"    value={profile.vat_number}    onChange={(v) => saveProfile({ vat_number: v })} />
          <ToggleRow
            icon={Receipt}
            label="VAT registered"
            hint="Adds 20% VAT to every quote"
            checked={vatRegistered}
            onChange={setVatRegistered}
            flush
          />
        </div>
      </Section>

      {/* PAYMENTS */}
      <Section title="Payments">
        <div className="card-surface p-5 space-y-3">
          <Input label="Bank account name"        value={bank.account_name}           onChange={(v) => saveBank({ account_name: v })} />
          <Input label="Bank name"                value={bank.bank_name}              onChange={(v) => saveBank({ bank_name: v })} />
          <div className="grid grid-cols-2 gap-2.5">
            <Input label="Sort code"              value={bank.sort_code}              onChange={(v) => saveBank({ sort_code: v })} />
            <Input label="Account number"         value={bank.account_number}         onChange={(v) => saveBank({ account_number: v })} />
          </div>
          <Input label="Payment reference instructions" value={bank.payment_reference_note} onChange={(v) => saveBank({ payment_reference_note: v })} />
          <Input label="Payment terms"            value={terms}                       onChange={setTerms} />

          <div className="rounded-2xl bg-ink text-paper p-4 flex items-center gap-3 mt-2">
            <div className="h-10 w-10 rounded-full bg-lime text-ink flex items-center justify-center shrink-0">
              <CreditCard className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">Stripe</p>
              <p className="text-[11px] text-paper/60">
                {stripeConnected ? "Connected — live links" : "Not connected"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = prompt("Stripe publishable key (pk_…)", stripe.publishable || "") ?? stripe.publishable;
                const sec = prompt("Stripe secret key (sk_…)", stripe.secret || "") ?? stripe.secret;
                saveStripe({ publishable: next, secret: sec });
              }}
              className="text-xs font-bold bg-lime text-ink px-3.5 py-2 rounded-full"
            >
              Manage
            </button>
          </div>
        </div>
      </Section>

      {/* WORKING HOURS */}
      <Section title="Working hours">
        <WorkingHoursPanel />
      </Section>

      {/* NOTIFICATIONS */}
      <Section title="Notifications">
        <div className="space-y-3">
          <PushPermissionCard />
          <NotificationToggles />
        </div>
      </Section>

      {/* GET MORE JOBS */}
      <Section title="Get more jobs">
        <CustomerQRCard />
      </Section>

      {/* REFER A MATE */}
      <Section title="Refer a mate">
        <ReferMate />
      </Section>

      {/* INTEGRATIONS */}
      <Section title="Integrations">
        <div className="card-surface divide-y divide-border">
          <SettingRow icon={Key} label="Claude API key" status="Optional — fallback quote generator is active" />
          <SettingRow icon={Key} label="OpenAI Whisper key" status="Add to enable voice-to-text" />
          <SettingRow icon={CreditCard} label="Stripe Connect" status={stripeConnected ? "Connected" : "Add to take card payments"} />
        </div>
      </Section>

      {/* FEEDBACK (haptics/sound — keep) */}
      <Section title="Feedback">
        <FeedbackToggles />
      </Section>

      {/* ACCOUNT */}
      <Section title="Account">
        <div className="card-surface divide-y divide-border">
          <button onClick={handleSignOut} className="px-5 py-4 flex items-center gap-3 font-semibold w-full text-left">
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
          <button
            onClick={() => {
              if (confirm("Permanently delete your account? This cannot be undone.")) {
                // TODO: wire account deletion
                alert("Account deletion isn't enabled yet. Please contact support.");
              }
            }}
            className="px-5 py-4 flex items-center gap-3 text-status-overdue font-semibold w-full text-left"
          >
            <Trash2 className="h-5 w-5" />
            Delete account
          </button>
        </div>
      </Section>

      <div className="h-6" />
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 mt-5">
      <h2 className="text-xl mb-2.5">{title}</h2>
      {children}
    </section>
  );
}

function NotificationToggles() {
  const [prefs, setPrefs] = useState({
    quoteRequest: true,
    quoteApproved: true,
    newMessage: true,
    invoiceOverdue: true,
  });
  const update = (patch: Partial<typeof prefs>) => setPrefs((p) => ({ ...p, ...patch }));
  return (
    <div className="card-surface divide-y divide-border">
      <ToggleRow icon={FileText}      label="New quote request" checked={prefs.quoteRequest}  onChange={(v) => update({ quoteRequest: v })} />
      <ToggleRow icon={CheckCircle2}  label="Quote approved"    checked={prefs.quoteApproved} onChange={(v) => update({ quoteApproved: v })} />
      <ToggleRow icon={MessageSquare} label="New message"       checked={prefs.newMessage}    onChange={(v) => update({ newMessage: v })} />
      <ToggleRow icon={AlertTriangle} label="Invoice overdue"   checked={prefs.invoiceOverdue} onChange={(v) => update({ invoiceOverdue: v })} />
    </div>
  );
}

function WorkingHoursPanel() {
  const fetchWh = useServerFn(getWorkingHours);
  const saveWh = useServerFn(saveWorkingHours);
  const [wh, setWh] = useState<WorkingHours | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { void fetchWh().then(setWh).catch(() => setWh(null)); }, []);

  useEffect(() => {
    if (!wh) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void saveWh({ data: wh }).catch(() => {}); }, 700);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [wh]);

  if (!wh) return <div className="card-surface p-5 text-sm text-muted-foreground">Loading…</div>;

  const days: Array<{ key: keyof WorkingHours["schedule"]; label: string }> = [
    { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
    { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" }, { key: "sun", label: "Sun" },
  ];

  const updateDay = (k: keyof WorkingHours["schedule"], patch: Partial<WorkingHours["schedule"]["mon"]>) =>
    setWh({ ...wh, schedule: { ...wh.schedule, [k]: { ...wh.schedule[k], ...patch } } });

  return (
    <div className="card-surface p-5 space-y-4">
      <label className="flex items-center justify-between cursor-pointer">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center"><Clock className="h-4 w-4" /></div>
          <div>
            <p className="font-semibold text-sm">Do Not Disturb</p>
            <p className="text-xs text-muted-foreground">Pause notifications outside working hours</p>
          </div>
        </div>
        <input
          type="checkbox"
          checked={wh.dnd_enabled}
          onChange={(e) => setWh({ ...wh, dnd_enabled: e.target.checked })}
          className="h-6 w-11 appearance-none rounded-full bg-secondary checked:bg-lime relative cursor-pointer transition
            before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition
            checked:before:translate-x-5"
        />
      </label>

      <div className="space-y-2">
        {days.map(({ key, label }) => {
          const d = wh.schedule[key];
          return (
            <div key={key} className="flex items-center gap-2">
              <label className="w-20 flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={d.enabled}
                  onChange={(e) => updateDay(key, { enabled: e.target.checked })}
                  className="h-4 w-4 accent-lime"
                />
                {label}
              </label>
              <input
                type="time"
                disabled={!d.enabled}
                value={d.start}
                onChange={(e) => updateDay(key, { start: e.target.value })}
                className="flex-1 bg-secondary rounded-xl px-3 py-2 text-sm outline-none disabled:opacity-40"
              />
              <span className="text-muted-foreground text-xs">–</span>
              <input
                type="time"
                disabled={!d.enabled}
                value={d.end}
                onChange={(e) => updateDay(key, { end: e.target.value })}
                className="flex-1 bg-secondary rounded-xl px-3 py-2 text-sm outline-none disabled:opacity-40"
              />
            </div>
          );
        })}
      </div>

      <label className="block">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Auto-reply (sent outside hours)</span>
        <textarea
          value={wh.auto_reply}
          onChange={(e) => setWh({ ...wh, auto_reply: e.target.value })}
          rows={2}
          className="mt-1 w-full bg-secondary rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-lime/40 font-medium"
        />
      </label>
    </div>
  );
}

function FeedbackToggles() {
  const [prefs, setPrefs] = useState(() => getFeedbackPrefs());
  const update = (patch: Partial<typeof prefs>) => {
    setPrefs((p) => ({ ...p, ...patch }));
    setFeedbackPrefs(patch);
    feedback("tap");
  };
  return (
    <div className="card-surface divide-y divide-border">
      <ToggleRow icon={Vibrate} label="Haptics" hint="Subtle vibration on actions" checked={prefs.haptics} onChange={(v) => update({ haptics: v })} />
      <ToggleRow icon={Volume2} label="Sound" hint="Soft confirmation tones" checked={prefs.sound} onChange={(v) => update({ sound: v })} />
    </div>
  );
}

function ToggleRow({
  icon: Icon, label, hint, checked, onChange, flush,
}: { icon: React.ComponentType<{ className?: string }>; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; flush?: boolean }) {
  return (
    <label className={`${flush ? "py-2" : "px-5 py-4"} flex items-center gap-3 cursor-pointer`}>
      <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-6 w-11 appearance-none rounded-full bg-secondary checked:bg-lime relative cursor-pointer transition
          before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition
          checked:before:translate-x-5"
      />
    </label>
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
        // fall through
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



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
  Camera, ImageIcon, Pencil, PenLine,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getWorkingHours, saveWorkingHours, type WorkingHours } from "@/lib/working-hours.functions";
import { CustomerQRCard, PushPermissionCard } from "@/components/CustomerQRCard";
import { BusinessLogo } from "@/components/BusinessLogo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BillingSection } from "@/components/BillingSection";

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
    logo_url: mockProfile.logo_url,
    quote_intro: mockProfile.quote_intro,
    quote_footer: mockProfile.quote_footer,
    signature_name: mockProfile.signature_name || mockProfile.full_name,
    show_signature: mockProfile.show_signature,
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleLogoFile = async (file: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg)$/i.test(file.type)) {
      toast.error("Use a PNG or JPG image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be 5MB or smaller");
      return;
    }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${userData.user.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("branding").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
      saveProfile({ logo_url: pub.publicUrl });
      toast.success("Logo updated");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't upload logo");
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = () => saveProfile({ logo_url: "" });

  return (
    <AppShell>
      <PageHeader title="Settings" subtitle="Configuration" />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleLogoFile(f);
          e.target.value = "";
        }}
      />

      {/* BRANDING */}
      <Section title="Branding">
        <div className="card-surface p-5 space-y-4">
          {profile.logo_url ? (
            <div className="flex flex-col items-center gap-3">
              <BusinessLogo logoUrl={profile.logo_url} businessName={profile.business_name} size="xl" />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="text-xs font-bold bg-ink text-paper px-4 py-2 rounded-full flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {uploading ? "Uploading…" : "Change logo"}
                </button>
                <button
                  type="button"
                  onClick={removeLogo}
                  className="text-xs font-bold bg-secondary text-ink px-4 py-2 rounded-full flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove logo
                </button>
              </div>
              <p className="text-xs text-muted-foreground text-center">Appears on all quotes, invoices and PDFs</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full rounded-2xl border-2 border-dashed border-lime/60 bg-ink text-paper px-5 py-8 flex flex-col items-center gap-2 hover:bg-ink/90 transition disabled:opacity-50"
            >
              <div className="h-14 w-14 rounded-full bg-lime text-ink flex items-center justify-center">
                <Camera className="h-6 w-6" />
              </div>
              <p className="font-bold text-sm">{uploading ? "Uploading…" : "Your business logo"}</p>
              <p className="text-xs text-paper/60 text-center max-w-[260px]">
                Appears on all quotes, invoices and PDFs. Tap to upload or take a photo.
              </p>
              <p className="text-[10px] uppercase tracking-widest text-paper/40 mt-1">PNG or JPG · max 5MB</p>
            </button>
          )}

          {!profile.logo_url && (
            <div className="flex items-center gap-3 rounded-2xl bg-secondary p-3">
              <BusinessLogo businessName={profile.business_name} size="md" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Placeholder used until you upload</p>
                <p className="text-sm font-semibold truncate">{profile.business_name || "Your business"}</p>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* QUOTE APPEARANCE */}
      <Section title="Quote appearance">
        <div className="card-surface p-5 space-y-4">
          <EditField icon={Building2} label="Business name on quotes" value={profile.business_name} onChange={(v) => saveProfile({ business_name: v })} />

          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
              <ImageIcon className="h-3 w-3" /> Opening message on quotes
            </span>
            <textarea
              value={profile.quote_intro}
              onChange={(e) => saveProfile({ quote_intro: e.target.value })}
              placeholder="Thank you for the opportunity to quote for your works. Please find our detailed quotation below."
              rows={3}
              className="mt-1 w-full bg-secondary rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-lime/40 font-medium"
            />
            <span className="text-[11px] text-muted-foreground">Appears at the top of every quote. Leave blank to skip.</span>
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
              <FileText className="h-3 w-3" /> Footer message
            </span>
            <textarea
              value={profile.quote_footer}
              onChange={(e) => saveProfile({ quote_footer: e.target.value })}
              placeholder="All works carried out to current British Standards. Payment due within 14 days of invoice."
              rows={3}
              className="mt-1 w-full bg-secondary rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-lime/40 font-medium"
            />
            <span className="text-[11px] text-muted-foreground">Appears at the bottom of every quote and invoice.</span>
          </label>

          <EditField
            icon={PenLine}
            label="Your name on quotes"
            value={profile.signature_name}
            onChange={(v) => saveProfile({ signature_name: v })}
            placeholder={profile.full_name}
          />
          <ToggleRow
            icon={PenLine}
            label="Show signature on quotes"
            hint="Adds a signature line at the bottom"
            checked={profile.show_signature}
            onChange={(v) => saveProfile({ show_signature: v })}
            flush
          />
        </div>
      </Section>



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

      {/* AUTO-CHASE */}
      <Section title="Auto-chase">
        <AutoChasePanel />
      </Section>

      {/* GOOGLE REVIEWS */}
      <Section title="Google reviews">
        <GoogleReviewPanel />
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

function AutoChasePanel() {
  const [enabled, setEnabled] = useState(mockProfile.auto_chase_enabled);
  const [offsets, setOffsets] = useState(mockProfile.chase_offsets.join(", "));
  const [t, setT] = useState({ ...mockProfile.chase_templates });
  const save = () => {
    mockProfile.auto_chase_enabled = enabled;
    const parsed = offsets.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => n > 0);
    if (parsed.length === 3) mockProfile.chase_offsets = parsed;
    mockProfile.chase_templates = { ...t };
    toast.success("Auto-chase settings saved");
  };
  return (
    <div className="card-surface p-4 space-y-3">
      <label className="flex items-center justify-between">
        <span className="text-sm font-semibold">Auto-chase overdue invoices</span>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-5 w-5 accent-lime" />
      </label>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Chase days (after due date)</p>
        <input value={offsets} onChange={(e) => setOffsets(e.target.value)} placeholder="7, 14, 21" className="w-full rounded-2xl bg-secondary px-3 py-2 text-sm" />
      </div>
      {(["first", "second", "final"] as const).map((k) => (
        <div key={k}>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">{k} chase template</p>
          <textarea
            value={t[k]}
            onChange={(e) => setT({ ...t, [k]: e.target.value })}
            rows={3}
            className="w-full rounded-2xl bg-secondary px-3 py-2 text-xs font-mono"
          />
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground">Variables: {"{name} {job} {amount} {link} {bank} {business}"}</p>
      <button onClick={save} className="w-full bg-ink text-paper rounded-full py-2.5 text-xs font-bold">Save chase settings</button>
    </div>
  );
}

function GoogleReviewPanel() {
  const [url, setUrl] = useState(mockProfile.google_review_url);
  return (
    <div className="card-surface p-4 space-y-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Your Google review link</p>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onBlur={() => { mockProfile.google_review_url = url; toast.success("Review link saved"); }}
        placeholder="https://g.page/r/..."
        className="w-full rounded-2xl bg-secondary px-3 py-2 text-sm"
      />
      <p className="text-[11px] text-muted-foreground">Used in review requests sent after a job is marked complete.</p>
    </div>
  );
}




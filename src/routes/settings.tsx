import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  userProfile,
  TRADE_TYPES,
  clearUserData,
  saveProfileToCloud,
} from "@/lib/user-data";
import { signOut } from "@/lib/auth";
import { feedback } from "@/lib/feedback";
import {
  Receipt, LogOut,
  CheckCircle2, FileText, MessageSquare, AlertTriangle, Trash2,
  Camera, Pencil, PenLine,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { PushPermissionCard } from "@/components/CustomerQRCard";
import { BusinessLogo } from "@/components/BusinessLogo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BillingSection } from "@/components/BillingSection";
import { ExportInvoicesButton } from "@/components/ExportInvoicesButton";
import { AccountingExportButton } from "@/components/AccountingExportButton";
import { deleteMyAccount } from "@/lib/account.functions";

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
  const deleteAccount = useServerFn(deleteMyAccount);
  const [deleting, setDeleting] = useState(false);
  const handleDeleteAccount = async () => {
    const first = confirm("Permanently delete your account and all your data? This cannot be undone.");
    if (!first) return;
    const second = prompt('Type DELETE to confirm.');
    if (second !== "DELETE") return;
    setDeleting(true);
    try {
      await deleteAccount();
      await signOut();
      clearUserData();
      toast.success("Account deleted.");
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete account.");
      setDeleting(false);
    }
  };

  // --- Business profile (editable) ---
  const [profile, setProfile] = useState({
    business_name: userProfile.business_name,
    full_name: userProfile.full_name,
    phone: userProfile.phone,
    email: userProfile.email,
    town: userProfile.town,
    address_line_1: userProfile.address_line_1,
    address_line_2: userProfile.address_line_2,
    postcode: userProfile.postcode,
    trade_type: userProfile.trade_type,
    registration_number: userProfile.registration_number,
    vat_number: userProfile.vat_number,
    logo_url: userProfile.logo_url,
    quote_intro: userProfile.quote_intro,
    quote_footer: userProfile.quote_footer,
    signature_name: userProfile.signature_name || userProfile.full_name,
    show_signature: userProfile.show_signature,
  });
  const saveProfile = (patch: Partial<typeof profile>) => setProfile((p) => ({ ...p, ...patch }));

  const [vatRegistered, setVatRegistered] = useState(userProfile.vat_registered);
  const [bank, setBank] = useState({
    account_name: userProfile.bank_account_name,
    bank_name: userProfile.bank_name,
    sort_code: userProfile.sort_code,
    account_number: userProfile.account_number,
    payment_reference_note: userProfile.payment_reference_note,
  });
  const [terms, setTerms] = useState(userProfile.payment_terms);
  const [defaultDepositPct, setDefaultDepositPct] = useState<number>(userProfile.default_deposit_percent ?? 30);
  const [labourHourly, setLabourHourly] = useState<number>(userProfile.labour_hourly_rate ?? 0);
  const [labourDay, setLabourDay] = useState<number>(userProfile.labour_day_rate ?? 0);

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
        payment_terms: terms,
        default_deposit_percent: defaultDepositPct,
      });
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, vatRegistered, bank, terms, defaultDepositPct]);

  const saveBank = (patch: Partial<typeof bank>) => setBank((b) => ({ ...b, ...patch }));

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

  const [showMore, setShowMore] = useState(false);

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

      {/* BUSINESS PROFILE — always open */}
      <Section title="Business profile" defaultOpen>
        <div className="card-surface p-5 space-y-3.5">
          <EditField label="Business name" value={profile.business_name} onChange={(v) => saveProfile({ business_name: v })} />
          <EditField label="Your name"     value={profile.full_name}     onChange={(v) => saveProfile({ full_name: v })} />
          <EditField label="Phone"         value={profile.phone}         onChange={(v) => saveProfile({ phone: v })} />
          <SelectField label="Trade type"  value={profile.trade_type}    onChange={(v) => saveProfile({ trade_type: v })} options={TRADE_TYPES} />
          <EditField label="Address line 1" value={profile.address_line_1} onChange={(v) => saveProfile({ address_line_1: v })} placeholder="e.g. 12 High Street" />
          <EditField label="Address line 2" value={profile.address_line_2} onChange={(v) => saveProfile({ address_line_2: v })} placeholder="Optional" />
          <EditField label="Town / City"   value={profile.town}          onChange={(v) => saveProfile({ town: v })} />
          <EditField label="Postcode"      value={profile.postcode}      onChange={(v) => saveProfile({ postcode: v })} />
        </div>
      </Section>

      {/* BILLING — always open */}
      <Section title="Billing" defaultOpen>
        <BillingSection />
      </Section>

      {/* ACCOUNTING EXPORT */}
      <Section title="Accounting export" defaultOpen>
        <AccountingSetup />
      </Section>


      {/* SIGN OUT */}
      <section className="px-5 mt-5">
        <button
          onClick={handleSignOut}
          className="w-full py-3 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-status-overdue transition"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </section>

      {/* MORE SETTINGS */}
      <section className="px-5 mt-5">
        <button
          type="button"
          onClick={() => { feedback("tap"); setShowMore((s) => !s); }}
          className="w-full card-surface px-5 py-4 flex items-center justify-between text-left"
          aria-expanded={showMore}
        >
          <span className="text-sm font-bold text-ink">More settings</span>
          <span
            className="text-muted-foreground text-xl leading-none transition-transform"
            style={{ transform: showMore ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            ›
          </span>
        </button>
      </section>

      {showMore && (
        <>
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
                </button>
              )}
            </div>
          </Section>

          <Section title="Quote appearance">
            <div className="card-surface p-5 space-y-4">
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  Opening message on quotes
                </span>
                <textarea
                  value={profile.quote_intro}
                  onChange={(e) => saveProfile({ quote_intro: e.target.value })}
                  rows={3}
                  className="mt-1.5 w-full bg-card border border-border rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-lime/30 resize-y leading-snug"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  Footer message
                </span>
                <textarea
                  value={profile.quote_footer}
                  onChange={(e) => saveProfile({ quote_footer: e.target.value })}
                  rows={3}
                  className="mt-1.5 w-full bg-card border border-border rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-lime/30 resize-y leading-snug"
                />
              </label>
              <EditField label="Your name on quotes" value={profile.signature_name} onChange={(v) => saveProfile({ signature_name: v })} placeholder="e.g. John Smith" />
              <ToggleRow icon={PenLine} label="Show signature on quotes" hint="Adds a signature line at the bottom" checked={profile.show_signature} onChange={(v) => saveProfile({ show_signature: v })} flush />
            </div>
          </Section>

          <Section title="VAT & registration">
            <div className="card-surface p-5 space-y-3.5">
              <EditField label="Gas Safe registration number" value={profile.registration_number} onChange={(v) => saveProfile({ registration_number: v })} />
              <EditField label="VAT number" value={profile.vat_number} onChange={(v) => saveProfile({ vat_number: v })} />
              <ToggleRow icon={Receipt} label="VAT registered" hint="Adds 20% VAT to every quote" checked={vatRegistered} onChange={setVatRegistered} flush />
            </div>
          </Section>

          <Section title="Bank details">
            <div className="card-surface p-5 space-y-3">
              <Input label="Bank account name" value={bank.account_name} onChange={(v) => saveBank({ account_name: v })} />
              <Input label="Bank name" value={bank.bank_name} onChange={(v) => saveBank({ bank_name: v })} />
              <div className="grid grid-cols-2 gap-2.5">
                <Input label="Sort code" value={bank.sort_code} onChange={(v) => saveBank({ sort_code: v })} />
                <Input label="Account number" value={bank.account_number} onChange={(v) => saveBank({ account_number: v })} />
              </div>
              <Input label="Payment reference instructions" value={bank.payment_reference_note} onChange={(v) => saveBank({ payment_reference_note: v })} multiline rows={2} />
              <Input label="Payment terms" value={terms} onChange={setTerms} multiline rows={3} />
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">
                  Default deposit % (jobs over £500)
                </label>
                <input
                  type="number" min={0} max={100} step={1}
                  value={defaultDepositPct}
                  onChange={(e) => {
                    const n = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)));
                    setDefaultDepositPct(n);
                  }}
                  className="w-full h-11 bg-card border border-border rounded-2xl px-4 text-sm font-semibold num outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-lime/30"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Applied to new AI-generated quotes that fall in the deposit-then-balance band.
                </p>
              </div>
            </div>
          </Section>


          <Section title="Notifications">
            <div className="space-y-3">
              <PushPermissionCard />
              <NotificationToggles />
            </div>
          </Section>

          <Section title="Danger zone">
            <div className="card-surface">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="px-5 py-4 flex items-center gap-3 text-status-overdue font-semibold w-full text-left disabled:opacity-60"
              >
                <Trash2 className="h-5 w-5" />
                {deleting ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </Section>
        </>
      )}

      <div className="h-6" />
    </AppShell>
  );
}

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="px-5 mt-5">
      <button
        type="button"
        onClick={() => {
          feedback("tap");
          setOpen((o) => !o);
        }}
        className="w-full flex items-center justify-between py-2 text-left"
        aria-expanded={open}
      >
        <h2 className="text-xl">{title}</h2>
        <span
          className="text-muted-foreground text-xl leading-none transition-transform"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ›
        </span>
      </button>
      {open && <div className="mt-1">{children}</div>}
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
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full h-11 bg-card border border-border rounded-2xl px-4 text-sm font-medium outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-lime/30"
      />
    </label>
  );
}

function SelectField({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full h-11 bg-card border border-border rounded-2xl px-3 text-sm font-medium outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-lime/30"
      >
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}

function AccountingSetup() {
  const SOFTWARE_OPTIONS: { value: "" | "xero" | "quickbooks" | "freeagent" | "sage" | "other" | "none"; label: string }[] = [
    { value: "", label: "Select…" },
    { value: "xero", label: "Xero" },
    { value: "quickbooks", label: "QuickBooks" },
    { value: "freeagent", label: "FreeAgent" },
    { value: "sage", label: "Sage" },
    { value: "other", label: "Other" },
    { value: "none", label: "None" },
  ];
  const [software, setSoftware] = useState<typeof userProfile.accounting_software>(userProfile.accounting_software || "");
  const [codes, setCodes] = useState({ ...userProfile.accounting_codes });
  const [saving, setSaving] = useState(false);
  const [codesOpen, setCodesOpen] = useState(false);

  const filledCodes = (Object.values(codes) as string[]).filter((v) => v && v.trim()).length;
  const totalCodes = 5;
  const hasPickedSoftware = !!software;

  const save = async () => {
    setSaving(true);
    try {
      await saveProfileToCloud({ accounting_software: software, accounting_codes: codes });
      toast.success("Accounting setup saved");
      setCodesOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const onSoftwareChange = async (v: typeof software) => {
    setSoftware(v);
    try {
      await saveProfileToCloud({ accounting_software: v, accounting_codes: codes });
    } catch {
      // silent — explicit Save button handles errors
    }
  };

  const codeRow = (key: keyof typeof codes, label: string, placeholder: string) => (
    <label className="block">
      <span className="text-xs text-muted-foreground font-semibold">{label}</span>
      <input
        value={codes[key]}
        placeholder={placeholder}
        onChange={(e) => setCodes((c) => ({ ...c, [key]: e.target.value }))}
        className="mt-1 w-full bg-secondary rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-lime/40 font-medium"
      />
    </label>
  );

  return (
    <div className="card-surface p-5 space-y-4">
      {/* Software picker */}
      <label className="block">
        <span className="text-xs text-muted-foreground font-semibold">Accounting software</span>
        <select
          value={software}
          onChange={(e) => void onSoftwareChange(e.target.value as typeof software)}
          className="mt-1 w-full bg-secondary rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-lime/40 font-medium"
        >
          {SOFTWARE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>

      {/* Account codes — collapsible summary row */}
      <button
        type="button"
        onClick={() => { feedback("tap"); setCodesOpen((s) => !s); }}
        className="w-full flex items-center justify-between text-left rounded-2xl bg-secondary/60 px-4 py-3"
        aria-expanded={codesOpen}
      >
        <div>
          <p className="text-sm font-semibold">Account codes</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filledCodes === 0 ? "Using default code (200)" : `${filledCodes} of ${totalCodes} codes set`}
          </p>
        </div>
        <span
          className="text-muted-foreground text-xl leading-none transition-transform"
          style={{ transform: codesOpen ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ›
        </span>
      </button>

      {codesOpen && (
        <div className="space-y-3 pt-1">
          <p className="text-xs text-muted-foreground">
            Map line item categories to the income codes used by your accounting software.
          </p>
          {codeRow("labour", "Labour income code", "e.g. 201")}
          {codeRow("materials", "Materials income code", "e.g. 202")}
          {codeRow("certificate", "Certificate income code", "e.g. 203")}
          {codeRow("cis_labour", "CIS labour income code", "e.g. 210")}
          {codeRow("other", "Other income code", "e.g. 260")}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full bg-ink text-paper rounded-full py-3 font-bold text-sm disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save codes"}
          </button>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-border/60" />

      {/* Primary download CTA */}
      {hasPickedSoftware ? (
        <>
          <AccountingExportButton />
          <p className="text-xs text-muted-foreground text-center">
            Paid invoices, one row per line item, formatted for your accounting software.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground text-center px-2">
          Pick your accounting software above to get a tailored export.
        </p>
      )}

      {/* Secondary: simple summary CSV */}
      <details className="group">
        <summary className="text-xs text-muted-foreground text-center cursor-pointer list-none hover:text-ink">
          Need a simple paid-quotes summary instead? ›
        </summary>
        <div className="pt-3">
          <ExportInvoicesButton />
        </div>
      </details>
    </div>
  );
}


function Input({
  label,
  value,
  onChange,
  multiline,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
}) {
  const fieldClass =
    "mt-1.5 w-full bg-card border border-border rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-lime/30";
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className={fieldClass + " resize-y leading-snug"}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass + " h-11"}
        />
      )}
    </label>
  );
}








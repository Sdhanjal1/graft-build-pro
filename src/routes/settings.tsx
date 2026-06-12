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
  Camera, Pencil, PenLine, ChevronRight,
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
import { useAutoSave } from "@/hooks/use-auto-save";
import { SaveIndicator } from "@/components/SaveIndicator";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

/** Trade-aware label for the "registration number" field. */
function registrationLabelForTrade(trade: string): string {
  const t = (trade || "").toLowerCase();
  if (t.includes("gas") || t.includes("plumb") || t.includes("heating")) return "Gas Safe registration number";
  if (t.includes("electric")) return "NICEIC / NAPIT number";
  if (t.includes("window") || t.includes("glaz")) return "FENSA / CERTASS number";
  return "Trade registration number";
}

function SettingsPage() {
  const navigate = useNavigate();
  const handleSignOut = async () => {
    await signOut();
    clearUserData();
    navigate({ to: "/auth" });
  };
  const deleteAccount = useServerFn(deleteMyAccount);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") return;
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

  // Debounced cloud-save, driven by useAutoSave so we share the same
  // saving / saved / error states with the inline indicator below.
  const {
    isSaving: profileSaving,
    isSaved: profileSaved,
    error: profileError,
    handleChange: queueProfileSave,
  } = useAutoSave<void>({
    debounceMs: 600,
    onSave: async () => {
      await saveProfileToCloud({
        ...profile,
        vat_registered: vatRegistered,
        bank_account_name: bank.account_name,
        bank_name: bank.bank_name,
        sort_code: bank.sort_code,
        account_number: bank.account_number,
        payment_reference_note: bank.payment_reference_note,
        payment_terms: terms,
        default_deposit_percent: defaultDepositPct,
        labour_hourly_rate: labourHourly,
        labour_day_rate: labourDay,
      });
    },
    errorTitle: "Couldn't save settings",
  });

  // Skip the first render so we don't fire a save on mount.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    queueProfileSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, vatRegistered, bank, terms, defaultDepositPct, labourHourly, labourDay]);

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

  // --- Collapsed summaries ---
  const fmtMoney = (n: number) => (n ? `£${n}` : "—");
  const pricingSummary = `${fmtMoney(labourHourly)}/hr · ${fmtMoney(labourDay)}/day`;
  const last4 = bank.account_number ? `••${bank.account_number.slice(-4)}` : "no bank";
  const gettingPaidSummary = `${bank.bank_name || "Bank not set"} ${last4} · ${defaultDepositPct}% deposit${vatRegistered ? " · VAT" : ""}`;
  const quoteLookSummary = profile.show_signature
    ? `Signed as ${profile.signature_name || profile.full_name || "you"}`
    : "No signature";
  const regLabel = registrationLabelForTrade(profile.trade_type);

  return (
    <AppShell>
      <div className="sticky top-0 z-30 bg-paper">
        <PageHeader
          title="Settings"
          subtitle="Configuration"
          right={
            <SaveIndicator
              isSaving={profileSaving}
              isSaved={profileSaved}
              error={profileError}
              className="text-paper/80"
            />
          }
        />
      </div>

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

      {/* 1. YOUR BUSINESS — identity + branding, open */}
      <Section
        title="Your business"
        defaultOpen
        summary={profile.business_name || "Add your business details"}
      >
        <div className="card-surface p-5 space-y-3.5">
          <EditField label="Business name" value={profile.business_name} onChange={(v) => saveProfile({ business_name: v })} />
          <EditField label="Your name"     value={profile.full_name}     onChange={(v) => saveProfile({ full_name: v })} />
          <EditField label="Phone"         value={profile.phone}         onChange={(v) => saveProfile({ phone: v })} inputMode="tel" />
          <SelectField label="Trade type"  value={profile.trade_type}    onChange={(v) => saveProfile({ trade_type: v })} options={TRADE_TYPES} />
          <EditField label="Address line 1" value={profile.address_line_1} onChange={(v) => saveProfile({ address_line_1: v })} placeholder="e.g. 12 High Street" />
          <EditField label="Address line 2" value={profile.address_line_2} onChange={(v) => saveProfile({ address_line_2: v })} placeholder="Optional" />
          <div className="grid grid-cols-2 gap-2.5">
            <EditField label="Town / City"   value={profile.town}          onChange={(v) => saveProfile({ town: v })} />
            <EditField
              label="Postcode"
              value={profile.postcode}
              onChange={(v) => saveProfile({ postcode: v.toUpperCase() })}
              autoCapitalize="characters"
            />
          </div>

          <div className="pt-3 border-t border-border/60">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">Business logo</p>
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
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full rounded-2xl border-2 border-dashed border-lime/60 bg-ink text-paper px-5 py-6 flex flex-col items-center gap-2 hover:bg-ink/90 transition disabled:opacity-50"
              >
                <div className="h-12 w-12 rounded-full bg-lime text-ink flex items-center justify-center">
                  <Camera className="h-5 w-5" />
                </div>
                <p className="font-bold text-sm">{uploading ? "Uploading…" : "Add your logo"}</p>
                <p className="text-xs text-paper/60 text-center max-w-[260px]">
                  Appears on all quotes, invoices and PDFs.
                </p>
              </button>
            )}
          </div>
        </div>
      </Section>

      {/* 2. YOUR PRICING — collapsed with summary */}
      <Section title="Your pricing" summary={pricingSummary}>
        <div className="card-surface p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <MoneyField label="Hourly rate" value={labourHourly} onChange={setLabourHourly} placeholder="45" />
            <MoneyField label="Day rate"    value={labourDay}    onChange={setLabourDay}    placeholder="280" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Used to price labour on your quotes — so you never have to correct it.
          </p>
        </div>
      </Section>

      {/* 3. GETTING PAID — bank, terms, deposit, VAT, Gas Safe, card payments, collapsed */}
      <Section title="Getting paid" summary={gettingPaidSummary}>
        <div className="space-y-3">
          <div className="card-surface p-5 space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Bank details</p>
            <Input label="Bank account name" value={bank.account_name} onChange={(v) => saveBank({ account_name: v })} />
            <Input label="Bank name" value={bank.bank_name} onChange={(v) => saveBank({ bank_name: v })} />
            <div className="grid grid-cols-2 gap-2.5">
              <Input label="Sort code" value={bank.sort_code} onChange={(v) => saveBank({ sort_code: v })} inputMode="numeric" />
              <Input label="Account number" value={bank.account_number} onChange={(v) => saveBank({ account_number: v })} inputMode="numeric" />
            </div>
            <Input label="Payment reference instructions" value={bank.payment_reference_note} onChange={(v) => saveBank({ payment_reference_note: v })} multiline rows={2} />
          </div>

          <div className="card-surface p-5 space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Terms & deposit</p>
            <Input label="Payment terms" value={terms} onChange={setTerms} multiline rows={3} />
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">
                Default deposit % (jobs over £500)
              </label>
              <input
                type="number" min={0} max={100} step={1}
                inputMode="numeric"
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

          <div className="card-surface p-5 space-y-3.5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">VAT & registration</p>
            <EditField label={regLabel} value={profile.registration_number} onChange={(v) => saveProfile({ registration_number: v })} />
            <ToggleRow icon={Receipt} label="VAT registered" hint="Adds 20% VAT to every quote" checked={vatRegistered} onChange={setVatRegistered} flush />
            {vatRegistered && (
              <EditField
                label="VAT number"
                value={profile.vat_number}
                onChange={(v) => saveProfile({ vat_number: v.toUpperCase() })}
                placeholder="e.g. GB123456789"
                autoCapitalize="characters"
              />
            )}
          </div>

          <BillingSection show="connect" />
        </div>
      </Section>

      {/* 4. HOW QUOTES LOOK — collapsed */}
      <Section title="How quotes look" summary={quoteLookSummary}>
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

      {/* 5. NOTIFICATIONS — collapsed */}
      <Section title="Notifications" summary="Push & email alerts">
        <div className="space-y-3">
          <PushPermissionCard />
          <NotificationToggles />
        </div>
      </Section>

      {/* 6. ACCOUNT & BILLING — collapsed */}
      <Section title="Account & billing" summary="Subscription, exports, sign out">
        <div className="space-y-3">
          <BillingSection show="subscription" />
          <AccountingSetup />
          <div className="card-surface">
            <button
              onClick={handleSignOut}
              className="w-full px-5 py-4 flex items-center gap-3 text-sm font-semibold text-muted-foreground hover:text-status-overdue transition text-left"
            >
              <LogOut className="h-5 w-5" />
              Sign out
            </button>
          </div>
        </div>
      </Section>

      {/* 7. DANGER ZONE — collapsed, tinted */}
      <Section title="Danger zone" tone="danger" summary="Permanent account deletion">
        <div className="card-surface">
          <button
            onClick={() => {
              setDeleteConfirm("");
              setDeleteOpen(true);
            }}
            disabled={deleting}
            className="px-5 py-4 flex items-center gap-3 text-status-overdue font-semibold w-full text-left disabled:opacity-60"
          >
            <Trash2 className="h-5 w-5" />
            {deleting ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </Section>

      <div className="h-6" />

      {/* Delete account dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={(v) => !deleting && setDeleteOpen(v)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-status-overdue">Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes your profile, quotes, invoices and clients.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Type DELETE to confirm
            </span>
            <input
              autoFocus
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="mt-1.5 w-full h-11 bg-card border border-border rounded-2xl px-4 text-sm font-semibold outline-none focus:border-status-overdue focus:ring-2 focus:ring-status-overdue/30"
            />
          </label>
          <AlertDialogFooter>
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
              className="px-4 py-2 rounded-full text-sm font-semibold bg-secondary text-ink disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={deleting || deleteConfirm !== "DELETE"}
              className="px-4 py-2 rounded-full text-sm font-bold bg-status-overdue text-white disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete account"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}


function Section({
  title,
  children,
  defaultOpen = false,
  summary,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  summary?: string;
  tone?: "default" | "danger";
}) {
  const [open, setOpen] = useState(defaultOpen);
  const danger = tone === "danger";
  return (
    <section className="px-5 mt-5">
      <button
        type="button"
        onClick={() => {
          feedback("tap");
          setOpen((o) => !o);
        }}
        className="w-full flex items-center justify-between gap-3 py-2 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <h2 className={`text-xl ${danger ? "text-status-overdue" : ""}`}>{title}</h2>
          {!open && summary && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{summary}</p>
          )}
        </div>
        <ChevronRight
          className={`h-5 w-5 shrink-0 transition-transform ${danger ? "text-status-overdue/70" : "text-muted-foreground"}`}
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        />
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
  label, value, onChange, placeholder, inputMode, autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "tel" | "email" | "numeric" | "decimal" | "search" | "url" | "none";
  autoCapitalize?: "off" | "none" | "on" | "sentences" | "words" | "characters";
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
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
  const [codesOpen, setCodesOpen] = useState(false);

  const filledCodes = (Object.values(codes) as string[]).filter((v) => v && v.trim()).length;
  const totalCodes = 5;
  const hasPickedSoftware = !!software;

  // Autosave accounting setup (matches the page-wide autosave behaviour).
  const {
    isSaving: acctSaving,
    isSaved: acctSaved,
    error: acctError,
    handleChange: queueAcctSave,
  } = useAutoSave<void>({
    debounceMs: 600,
    onSave: async () => {
      await saveProfileToCloud({ accounting_software: software, accounting_codes: codes });
    },
    errorTitle: "Couldn't save accounting setup",
  });

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    queueAcctSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [software, codes]);

  const codeRow = (key: keyof typeof codes, label: string, placeholder: string) => (
    <label className="block">
      <span className="text-xs text-muted-foreground font-semibold">{label}</span>
      <input
        value={codes[key]}
        placeholder={placeholder}
        inputMode="numeric"
        onChange={(e) => setCodes((c) => ({ ...c, [key]: e.target.value }))}
        className="mt-1 w-full bg-secondary rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-lime/40 font-medium"
      />
    </label>
  );

  return (
    <div className="card-surface p-5 space-y-4">
      {/* Software picker */}
      <label className="block">
        <span className="text-xs text-muted-foreground font-semibold flex items-center justify-between">
          <span>Accounting software</span>
          <SaveIndicator isSaving={acctSaving} isSaved={acctSaved} error={acctError} showLabel={false} />
        </span>
        <select
          value={software}
          onChange={(e) => setSoftware(e.target.value as typeof software)}
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
        <ChevronRight
          className="h-5 w-5 text-muted-foreground transition-transform"
          style={{ transform: codesOpen ? "rotate(90deg)" : "rotate(0deg)" }}
        />
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
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  inputMode?: "text" | "tel" | "email" | "numeric" | "decimal" | "search" | "url" | "none";
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
          inputMode={inputMode}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass + " h-11"}
        />
      )}
    </label>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState<string>(value ? String(value) : "");
  useEffect(() => {
    setText(value ? String(value) : "");
  }, [value]);
  const commit = () => {
    const n = Math.max(0, Number(text) || 0);
    onChange(n);
    setText(n ? String(n) : "");
  };
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
      <div className="relative mt-1.5">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground pointer-events-none">£</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          className="w-full h-11 bg-card border border-border rounded-2xl pl-8 pr-4 text-sm font-semibold num outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-lime/30"
        />
      </div>
    </label>
  );
}

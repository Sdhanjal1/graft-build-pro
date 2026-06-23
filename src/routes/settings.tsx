import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RouteError, RouteNotFound } from "@/components/RouteBoundary";
import { useEffect, useMemo, useRef, useState } from "react";
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
  Briefcase, PoundSterling, Landmark, FileSignature, Bell, CreditCard, AlertOctagon,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { PushPermissionCard } from "@/components/CustomerQRCard";
import { BusinessLogo } from "@/components/BusinessLogo";
import { formatGBP } from "@/lib/user-data";
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
  errorComponent: RouteError,
  notFoundComponent: () => <RouteNotFound />,
});

type LucideIcon = React.ComponentType<{ className?: string }>;
type SectionId =
  | "business"
  | "pricing"
  | "getting-paid"
  | "quote-look"
  | "notifications"
  | "account"
  | "danger";

/** Trade-aware label for the "registration number" field. */
function registrationLabelForTrade(trade: string): string {
  const t = (trade || "").toLowerCase();
  if (t.includes("gas") || t.includes("plumb") || t.includes("heating")) return "Gas Safe registration number";
  if (t.includes("electric")) return "NICEIC / NAPIT number";
  if (t.includes("window") || t.includes("glaz")) return "FENSA / CERTASS number";
  return "Trade registration number";
}

function registrationHintForTrade(trade: string): string | null {
  const t = (trade || "").toLowerCase();
  if (t.includes("gas") || t.includes("plumb") || t.includes("heating")) return "Required to legally certify gas work in the UK.";
  if (t.includes("electric")) return "Required for Part P notifiable electrical work.";
  if (t.includes("window") || t.includes("glaz")) return "Required to self-certify replacement windows.";
  return null;
}

function formatSortCode(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  return digits.length <= 2
    ? digits
    : digits.length <= 4
      ? `${digits.slice(0, 2)}-${digits.slice(2)}`
      : `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
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
      toast.error(e instanceof Error ? e.message : "Couldn't delete account.");
      setDeleting(false);
    }
  };

  // --- Accordion state (one open at a time, all closed by default) ---
  const [openSection, setOpenSection] = useState<SectionId | null>(null);
  const toggleSection = (id: SectionId) => {
    feedback("tap");
    setOpenSection((curr) => (curr === id ? null : id));
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

  const {
    isSaving: profileSaving,
    isSaved: profileSaved,
    error: profileError,
    handleChange: queueProfileSave,
  } = useAutoSave<void>({
    debounceMs: 600,
    onSave: async () => {
      // Skip while a logo upload is in flight — the upload's own
      // saveProfile({ logo_url }) is the authoritative writer.
      if (uploadingRef.current) return;
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
  const uploadingRef = useRef(false);

  const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([
      p,
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error(`${label} timed out`)), ms),
      ),
    ]);

  const runLogoUpload = async (input: File) => {
    console.info("[logo] picked", { name: input.name, type: input.type, size: input.size });

    const rawName = (input.name || "logo").toLowerCase();
    const extMatch = rawName.match(/\.([a-z0-9]+)$/);
    const ext = extMatch?.[1] ?? "";
    const mime = (input.type || "").toLowerCase();
    const isHeic = ext === "heic" || ext === "heif" || mime === "image/heic" || mime === "image/heif";
    const allowedExt = ["png", "jpg", "jpeg", "webp"];
    const allowedMime = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    const looksLikeImage =
      allowedMime.includes(mime) || (!mime && allowedExt.includes(ext));

    if (!isHeic && !looksLikeImage) {
      toast.error("Use a PNG, JPG or WebP image", { duration: 6000 });
      return;
    }
    if (input.size > 8 * 1024 * 1024) {
      toast.error("Logo must be 8MB or smaller", { duration: 6000 });
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("You're offline. Reconnect to upload.", { duration: 6000 });
      return;
    }

    console.info("[logo] validated");

    let workingBlob: Blob = input;
    let uploadExt = ext || "png";
    let uploadType = mime || "image/png";

    if (isHeic) {
      console.info("[logo] converting HEIC");
      try {
        const { default: heic2any } = await import("heic2any");
        const converted = await withTimeout(
          heic2any({ blob: input, toType: "image/jpeg", quality: 0.9 }) as Promise<Blob | Blob[]>,
          30000,
          "HEIC conversion",
        );
        workingBlob = Array.isArray(converted) ? converted[0] : converted;
        uploadExt = "jpg";
        uploadType = "image/jpeg";
      } catch (convErr) {
        console.error("[logo] HEIC conversion failed", convErr);
        toast.error(
          "Couldn't convert that iPhone photo. In Camera settings choose 'Most Compatible', or pick a PNG/JPG.",
          { duration: 8000 },
        );
        return;
      }
    } else {
      uploadExt = ext === "jpeg" ? "jpg" : (ext || (mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg"));
      uploadType =
        uploadExt === "png" ? "image/png" :
        uploadExt === "webp" ? "image/webp" : "image/jpeg";
    }

    // Re-pack into a clean File with explicit type + safe ASCII name.
    // supabase-js v2 has been observed to stall when File.type is empty,
    // and odd characters in name (spaces, parens, unicode) can break
    // multipart parsing on certain CDNs.
    const safeName = `logo-${Date.now()}.${uploadExt}`;
    const buf = await withTimeout(workingBlob.arrayBuffer(), 15000, "Read file");
    const file = new File([buf], safeName, { type: uploadType });
    console.info("[logo] normalized", { name: file.name, type: file.type, size: file.size });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    if (!userData.user) throw new Error("Not signed in");
    const path = `${userData.user.id}/${safeName}`;
    console.info("[logo] uploading →", path);

    const { error: upErr } = await withTimeout(
      supabase.storage.from("branding").upload(path, file, {
        upsert: true,
        contentType: uploadType,
        cacheControl: "3600",
      }),
      20000,
      "Upload",
    );
    if (upErr) throw upErr;
    console.info("[logo] uploaded ok");

    const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
    if (!pub?.publicUrl) throw new Error("Couldn't get public URL");
    console.info("[logo] public url", pub.publicUrl);

    saveProfile({ logo_url: pub.publicUrl });
    toast.success("Logo updated");
    console.info("[logo] done");
  };

  const handleLogoFile = async (input: File) => {
    if (!input) return;
    setUploading(true);
    uploadingRef.current = true;
    try {
      // Hard outer safety net: even if every inner promise stalls,
      // we always release the button and surface an error toast.
      await withTimeout(runLogoUpload(input), 45000, "Logo upload");
    } catch (e) {
      console.error("[logo] upload failed", e);
      const msg = e instanceof Error ? e.message : String(e);
      if (/timed out/i.test(msg)) {
        toast.error("Upload didn't respond — check your connection and try again", { duration: 6000 });
      } else {
        toast.error(`Couldn't upload logo: ${msg || "unknown error"}`, { duration: 8000 });
      }
    } finally {
      setUploading(false);
      uploadingRef.current = false;
    }
  };


  const removeLogo = () => saveProfile({ logo_url: "" });

  // --- Summaries + completion flags ---
  const fmtMoney = (n: number) => (n ? `£${n}` : "—");
  const pricingComplete = labourHourly > 0 || labourDay > 0;
  const pricingSummary = pricingComplete
    ? `${fmtMoney(labourHourly)}/hr · ${fmtMoney(labourDay)}/day`
    : "Set your hourly + day rates";
  const last4 = bank.account_number ? `••${bank.account_number.slice(-4)}` : "no bank";
  const bankComplete = !!bank.account_number;
  const gettingPaidSummary = bankComplete
    ? `${bank.bank_name || "Bank"} ${last4} · ${defaultDepositPct}% deposit${vatRegistered ? " · VAT" : ""}`
    : "Add bank details — get paid faster";
  const quoteLookSummary = profile.show_signature
    ? `Signed as ${profile.signature_name || profile.full_name || "you"}`
    : "No signature";
  const regLabel = registrationLabelForTrade(profile.trade_type);
  const regHint = useMemo(() => registrationHintForTrade(profile.trade_type), [profile.trade_type]);

  return (
    <AppShell>
      <PageHeader
        title="Settings"
        subtitle="Your setup"
        right={
          <SaveIndicator
            isSaving={profileSaving}
            isSaved={profileSaved}
            error={profileError}
            className="text-paper/80"
          />
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleLogoFile(f);
          e.target.value = "";
        }}
      />

      <div className="px-5 mt-5 space-y-4">
        {/* 1. YOUR BUSINESS */}
        <Section
          id="business"
          title="Your business"
          icon={Briefcase}
          open={openSection === "business"}
          onToggle={toggleSection}
          summary={profile.business_name || "Finish your business details"}
        >
          <FieldGroup label="Business logo">
            {profile.logo_url ? (
              <div className="flex items-center gap-4">
                <BusinessLogo logoUrl={profile.logo_url} businessName={profile.business_name} size="lg" />
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="text-xs font-bold bg-ink text-paper px-4 py-2 rounded-full flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {uploading ? "Uploading…" : "Change"}
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
                className="w-full rounded-2xl border border-dashed border-border bg-card/40 px-5 py-6 flex flex-col items-center gap-2 hover:border-ink/30 hover:bg-card/60 transition disabled:opacity-50"
              >
                <div className="h-11 w-11 rounded-full bg-lime text-ink flex items-center justify-center">
                  <Camera className="h-5 w-5" />
                </div>
                <p className="font-bold text-sm text-ink">{uploading ? "Uploading…" : "Add your logo"}</p>
                <p className="text-xs text-muted-foreground text-center max-w-[260px]">
                  Appears on all quotes, invoices and PDFs.
                </p>
              </button>
            )}
          </FieldGroup>

          <FieldGroup label="Business details">
            <FieldList>
              <EditField label="Business name" value={profile.business_name} onChange={(v) => saveProfile({ business_name: v })} />
              <EditField label="Your name" value={profile.full_name} onChange={(v) => saveProfile({ full_name: v })} />
              <EditField label="Phone" value={profile.phone} onChange={(v) => saveProfile({ phone: v })} inputMode="tel" />
              <SelectField label="Trade type" value={profile.trade_type} onChange={(v) => saveProfile({ trade_type: v })} options={TRADE_TYPES} />
            </FieldList>
          </FieldGroup>

          <FieldGroup label="Address">
            <FieldList>
              <EditField label="Line 1" value={profile.address_line_1} onChange={(v) => saveProfile({ address_line_1: v })} placeholder="e.g. 12 High Street" />
              <EditField label="Line 2" value={profile.address_line_2} onChange={(v) => saveProfile({ address_line_2: v })} placeholder="Optional" />
              <div className="grid grid-cols-2 gap-3">
                <EditField label="Town / City" value={profile.town} onChange={(v) => saveProfile({ town: v })} />
                <EditField
                  label="Postcode"
                  value={profile.postcode}
                  onChange={(v) => saveProfile({ postcode: v.toUpperCase() })}
                  autoCapitalize="characters"
                />
              </div>
            </FieldList>
          </FieldGroup>
        </Section>

        {/* 2. YOUR PRICING */}
        <Section
          id="pricing"
          title="Your pricing"
          icon={PoundSterling}
          open={openSection === "pricing"}
          onToggle={toggleSection}
          summary={pricingSummary}
          incomplete={!pricingComplete}
        >
          <FieldGroup
            label="Labour rates"
            hint="Used to price labour on your quotes — so you never have to correct it."
          >
            <div className="grid grid-cols-2 gap-3">
              <MoneyField label="Hourly rate" value={labourHourly} onChange={setLabourHourly} placeholder="45" />
              <MoneyField label="Day rate" value={labourDay} onChange={setLabourDay} placeholder="280" />
            </div>
            {labourHourly > 0 && labourDay === 0 && (
              <p className="text-xs text-muted-foreground mt-3">Day rate ≈ 8h × hourly = £{labourHourly * 8}</p>
            )}
            {labourDay > 0 && labourHourly === 0 && (
              <p className="text-xs text-muted-foreground mt-3">Hourly ≈ day ÷ 8 = £{Math.round(labourDay / 8)}</p>
            )}
          </FieldGroup>
        </Section>

        {/* 3. GETTING PAID */}
        <Section
          id="getting-paid"
          title="Getting paid"
          icon={Landmark}
          open={openSection === "getting-paid"}
          onToggle={toggleSection}
          summary={gettingPaidSummary}
          incomplete={!bankComplete}
        >
          <FieldGroup label="Bank details">
            <FieldList>
              <Input label="Bank account name" value={bank.account_name} onChange={(v) => saveBank({ account_name: v })} />
              <Input label="Bank name" value={bank.bank_name} onChange={(v) => saveBank({ bank_name: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Sort code"
                  value={bank.sort_code}
                  onChange={(v) => saveBank({ sort_code: formatSortCode(v) })}
                  inputMode="numeric"
                />
                <Input label="Account number" value={bank.account_number} onChange={(v) => saveBank({ account_number: v })} inputMode="numeric" />
              </div>
              <Input label="Payment reference instructions" value={bank.payment_reference_note} onChange={(v) => saveBank({ payment_reference_note: v })} multiline rows={2} />
            </FieldList>
          </FieldGroup>

          <FieldGroup label="Terms & deposit">
            <FieldList>
              <Input label="Payment terms" value={terms} onChange={setTerms} multiline rows={3} />
              <div>
                <FieldLabel>Default deposit % (jobs over £500)</FieldLabel>
                <input
                  type="number" min={0} max={100} step={1}
                  inputMode="numeric"
                  value={defaultDepositPct}
                  onChange={(e) => {
                    const n = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)));
                    setDefaultDepositPct(n);
                  }}
                  className={fieldInputClass + " h-11"}
                />
                <FieldHint>Applied to new AI-generated quotes that fall in the deposit-then-balance band.</FieldHint>
              </div>
            </FieldList>
          </FieldGroup>

          <FieldGroup label="VAT & registration">
            <FieldList>
              <div>
                <EditField label={regLabel} value={profile.registration_number} onChange={(v) => saveProfile({ registration_number: v })} />
                {regHint && <FieldHint>{regHint}</FieldHint>}
              </div>
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
            </FieldList>
          </FieldGroup>

          <FieldGroup label="Card payments">
            <BillingSection show="connect" />
          </FieldGroup>
        </Section>

        {/* 4. HOW QUOTES LOOK */}
        <Section
          id="quote-look"
          title="How quotes look"
          icon={FileSignature}
          open={openSection === "quote-look"}
          onToggle={toggleSection}
          summary={quoteLookSummary}
        >
          <FieldGroup label="Live preview" hint="As your customer sees it.">
            <QuoteLookPreview
              profile={profile}
              vatRegistered={vatRegistered}
              labourDay={labourDay}
              terms={terms}
            />
          </FieldGroup>

          <FieldGroup label="Quote copy">
            <FieldList>
              <label className="block">
                <FieldLabel>Opening message on quotes</FieldLabel>
                <textarea
                  value={profile.quote_intro}
                  onChange={(e) => saveProfile({ quote_intro: e.target.value })}
                  rows={2}
                  className={fieldInputClass + " resize-y leading-snug py-3"}
                />
              </label>
              <label className="block">
                <FieldLabel>Footer message</FieldLabel>
                <textarea
                  value={profile.quote_footer}
                  onChange={(e) => saveProfile({ quote_footer: e.target.value })}
                  rows={3}
                  className={fieldInputClass + " resize-y leading-snug py-3"}
                />
              </label>
            </FieldList>
          </FieldGroup>

          <FieldGroup label="Signature">
            <FieldList>
              <EditField label="Your name on quotes" value={profile.signature_name} onChange={(v) => saveProfile({ signature_name: v })} placeholder="e.g. John Smith" />
              <ToggleRow icon={PenLine} label="Show signature on quotes" hint="Adds a signature line at the bottom" checked={profile.show_signature} onChange={(v) => saveProfile({ show_signature: v })} flush />
              {profile.show_signature && (
                <p className="font-serif italic text-muted-foreground text-sm pl-12">
                  — {profile.signature_name || profile.full_name || "your name"}
                </p>
              )}
            </FieldList>
          </FieldGroup>
        </Section>

        {/* 5. NOTIFICATIONS */}
        <Section
          id="notifications"
          title="Notifications"
          icon={Bell}
          open={openSection === "notifications"}
          onToggle={toggleSection}
          summary="Push & email alerts"
        >
          <FieldGroup label="Device push">
            <PushPermissionCard />
          </FieldGroup>
          <FieldGroup label="What to notify me about">
            <NotificationToggles />
          </FieldGroup>
        </Section>

        {/* 6. ACCOUNT & BILLING */}
        <Section
          id="account"
          title="Account & billing"
          icon={CreditCard}
          open={openSection === "account"}
          onToggle={toggleSection}
          summary="Subscription, exports, sign out"
        >
          <FieldGroup label="Subscription">
            <BillingSection show="subscription" />
          </FieldGroup>
          <FieldGroup label="Accounting export">
            <AccountingSetup />
          </FieldGroup>
          <FieldGroup label="Session">
            <button
              onClick={handleSignOut}
              className="w-full px-1 py-3 flex items-center gap-3 text-sm font-semibold text-muted-foreground hover:text-status-overdue transition text-left"
            >
              <LogOut className="h-5 w-5" />
              Sign out
            </button>
          </FieldGroup>
        </Section>

        {/* 7. DANGER ZONE */}
        <Section
          id="danger"
          title="Account"
          icon={AlertOctagon}
          open={openSection === "danger"}
          onToggle={toggleSection}
          tone="danger"
          summary="Delete your account"
        >
          <button
            onClick={() => {
              setDeleteConfirm("");
              setDeleteOpen(true);
            }}
            disabled={deleting}
            className="w-full rounded-2xl bg-status-overdue/5 border border-status-overdue/20 px-5 py-4 flex items-center gap-3 text-status-overdue font-semibold text-left disabled:opacity-60"
          >
            <Trash2 className="h-5 w-5" />
            <span className="flex-1">{deleting ? "Deleting…" : "Delete account"}</span>
            <ChevronRight className="h-4 w-4 text-status-overdue/60" />
          </button>
        </Section>
      </div>

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
            <FieldLabel>Type DELETE to confirm</FieldLabel>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="mt-2 w-full h-11 bg-card border border-border rounded-2xl px-4 text-sm font-semibold outline-none focus:border-status-overdue focus:ring-2 focus:ring-status-overdue/30"
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
              className="px-4 py-2 rounded-full text-sm font-bold bg-status-overdue text-paper disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete account"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

/* ============================================================ */
/*  Section (controlled accordion)                                */
/* ============================================================ */

function Section({
  id,
  title,
  children,
  open,
  onToggle,
  summary,
  tone = "default",
  icon: Icon,
  incomplete = false,
}: {
  id: SectionId;
  title: string;
  children: React.ReactNode;
  open: boolean;
  onToggle: (id: SectionId) => void;
  summary?: string;
  tone?: "default" | "danger";
  icon?: LucideIcon;
  incomplete?: boolean;
}) {
  const danger = tone === "danger";
  return (
    <section className={open ? "bg-card/30" : ""}>
      <button
        type="button"
        onClick={() => onToggle(id)}
        className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors ${
          open ? "" : "hover:bg-card/40"
        }`}
        aria-expanded={open}
      >
        {Icon && (
          <div
            className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
              danger ? "bg-status-overdue/10 text-status-overdue" : "bg-secondary text-ink"
            }`}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2
            className={`leading-tight ${
              open ? "text-2xl" : "text-base font-bold"
            } ${danger ? (open ? "text-status-overdue" : "text-status-overdue/85") : "text-ink"}`}
            style={open ? { fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.01em" } : undefined}
          >
            {title}
            {incomplete && !open && (
              <span className="ml-2 inline-flex items-center align-middle text-[10px] font-bold uppercase tracking-wider bg-status-pending/15 text-status-pending px-1.5 py-0.5 rounded-full">
                Set up
              </span>
            )}
          </h2>
          {!open && summary && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{summary}</p>
          )}
        </div>
        <ChevronRight
          className={`h-5 w-5 shrink-0 transition-transform ${danger ? "text-status-overdue/70" : "text-muted-foreground"}`}
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        />
      </button>
      {open && (
        <div className="px-5 pb-7 pt-1 space-y-7 border-t border-border/40">
          <div className="h-1" />
          {children}
        </div>
      )}
    </section>
  );
}

/* ============================================================ */
/*  Field primitives                                              */
/* ============================================================ */

const fieldInputClass =
  "mt-2 w-full bg-paper border border-border rounded-xl px-4 text-sm font-medium text-ink outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-lime/30";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-sm font-semibold text-ink">{children}</span>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-muted-foreground mt-2 leading-snug">{children}</p>
  );
}

/** A labelled logical group of fields with breathing room above it. */
function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3">
        <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
          {label}
        </p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** Flat list of fields separated by hairlines — no boxes per field. */
function FieldList({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-border/50">
      {Array.isArray(children)
        ? children.map((child, i) => (
            <div key={i} className={i === 0 ? "pb-4" : i === children.length - 1 ? "pt-4" : "py-4"}>
              {child}
            </div>
          ))
        : <div>{children}</div>}
    </div>
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
    <div className="divide-y divide-border/50">
      <ToggleRow icon={FileText} label="New quote request" checked={prefs.quoteRequest} onChange={(v) => update({ quoteRequest: v })} />
      <ToggleRow icon={CheckCircle2} label="Quote approved" checked={prefs.quoteApproved} onChange={(v) => update({ quoteApproved: v })} />
      <ToggleRow icon={MessageSquare} label="New message" checked={prefs.newMessage} onChange={(v) => update({ newMessage: v })} />
      <ToggleRow icon={AlertTriangle} label="Invoice overdue" checked={prefs.invoiceOverdue} onChange={(v) => update({ invoiceOverdue: v })} />
    </div>
  );
}

function ToggleRow({
  icon: Icon, label, hint, checked, onChange, flush,
}: { icon: React.ComponentType<{ className?: string }>; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; flush?: boolean }) {
  return (
    <label className={`${flush ? "py-1" : "py-3"} flex items-center gap-3 cursor-pointer`}>
      <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-ink">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
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
      <FieldLabel>{label}</FieldLabel>
      <input
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        onChange={(e) => onChange(e.target.value)}
        className={fieldInputClass + " h-11"}
      />
    </label>
  );
}

function SelectField({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldInputClass + " h-11 pr-3"}
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
  const [summaryOpen, setSummaryOpen] = useState(false);

  const filledCodes = (Object.values(codes) as string[]).filter((v) => v && v.trim()).length;
  const totalCodes = 5;
  const hasPickedSoftware = !!software;

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
      <FieldLabel>{label}</FieldLabel>
      <input
        value={codes[key]}
        placeholder={placeholder}
        inputMode="numeric"
        onChange={(e) => setCodes((c) => ({ ...c, [key]: e.target.value }))}
        className={fieldInputClass + " h-11"}
      />
    </label>
  );

  return (
    <div className="divide-y divide-border/50">
      {/* Software picker */}
      <div className="pb-4">
        <label className="block">
          <span className="flex items-center justify-between">
            <FieldLabel>Accounting software</FieldLabel>
            <SaveIndicator isSaving={acctSaving} isSaved={acctSaved} error={acctError} showLabel={false} />
          </span>
          <select
            value={software}
            onChange={(e) => setSoftware(e.target.value as typeof software)}
            className={fieldInputClass + " h-11 pr-3"}
          >
            {SOFTWARE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Account codes — collapsible row */}
      <div className="py-2">
        <button
          type="button"
          onClick={() => { feedback("tap"); setCodesOpen((s) => !s); }}
          className="w-full flex items-center justify-between text-left py-2"
          aria-expanded={codesOpen}
        >
          <div>
            <p className="text-sm font-semibold text-ink">Account codes</p>
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
          <div className="space-y-3 pt-3 pb-2">
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
      </div>

      {/* Primary export */}
      <div className="py-4 space-y-3">
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
      </div>

      {/* Secondary summary CSV — uses Section-style chevron row */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => { feedback("tap"); setSummaryOpen((s) => !s); }}
          className="w-full flex items-center justify-between text-left py-2"
          aria-expanded={summaryOpen}
        >
          <p className="text-xs text-muted-foreground">
            Need a simple paid-quotes summary instead?
          </p>
          <ChevronRight
            className="h-4 w-4 text-muted-foreground transition-transform"
            style={{ transform: summaryOpen ? "rotate(90deg)" : "rotate(0deg)" }}
          />
        </button>
        {summaryOpen && (
          <div className="pt-3">
            <ExportInvoicesButton />
          </div>
        )}
      </div>
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
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className={fieldInputClass + " resize-y leading-snug py-3"}
        />
      ) : (
        <input
          value={value}
          inputMode={inputMode}
          onChange={(e) => onChange(e.target.value)}
          className={fieldInputClass + " h-11"}
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
  const [text, setText] = useState<string>(String(value ?? 0));
  useEffect(() => {
    setText(String(value ?? 0));
  }, [value]);
  const commit = () => {
    const n = Math.max(0, Number(text) || 0);
    onChange(n);
    setText(String(n));
  };
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative mt-2">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground pointer-events-none">£</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commit}
          className="w-full h-11 bg-paper border border-border rounded-xl pl-8 pr-4 text-sm font-semibold num text-ink outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-lime/30"
        />
      </div>
    </label>
  );
}

function QuoteLookPreview({
  profile,
  vatRegistered,
  labourDay,
  terms,
}: {
  profile: {
    business_name: string;
    logo_url: string;
    address_line_1: string;
    address_line_2: string;
    town: string;
    postcode: string;
    quote_intro: string;
    quote_footer: string;
    signature_name: string;
    full_name: string;
    show_signature: boolean;
  };
  vatRegistered: boolean;
  labourDay: number;
  terms: string;
}) {
  const businessName = profile.business_name?.trim() || "Your Business Name";
  const addressLine =
    [profile.address_line_1, profile.address_line_2, profile.town, profile.postcode]
      .map((s) => (s || "").trim())
      .filter(Boolean)
      .join(", ") || "Your business address";
  const signatureName =
    profile.signature_name?.trim() || profile.full_name?.trim() || "Your name";

  const labourPrice = labourDay > 0 ? labourDay : 280;
  const materialsPrice = 120;
  const subtotal = labourPrice + materialsPrice;
  const vat = vatRegistered ? Math.round(subtotal * 0.2 * 100) / 100 : 0;
  const total = subtotal + vat;

  return (
    <div className="rounded-2xl border border-border overflow-hidden bg-paper">
      <div className="bg-ink text-paper px-4 pt-4 pb-3 flex items-center gap-3">
        <BusinessLogo logoUrl={profile.logo_url} businessName={businessName} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate">{businessName}</p>
          <p className="text-[10px] text-paper/60 truncate">Quote Q-0001</p>
        </div>
      </div>

      <div className="bg-paper text-ink">
        <section className="px-4 pt-3">
          <h3 className="text-base leading-tight font-semibold">Kitchen tap replacement</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">For Sample Customer</p>
        </section>

        {profile.quote_intro?.trim() && (
          <section className="px-4 mt-2">
            <p className="text-[12px] leading-relaxed whitespace-pre-line text-ink/90">
              {profile.quote_intro}
            </p>
          </section>
        )}

        <section className="px-4 mt-3">
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="px-3 pt-2 pb-1">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                Itemised
              </p>
            </div>
            <ul>
              <li className="px-3 py-2 flex items-start gap-2 border-t border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium">Labour — 1 day</p>
                </div>
                <p className="num text-[12px]">{formatGBP(labourPrice)}</p>
              </li>
              <li className="px-3 py-2 flex items-start gap-2 border-t border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium">Materials</p>
                  <p className="text-[10px] text-muted-foreground">1 × {formatGBP(materialsPrice)}</p>
                </div>
                <p className="num text-[12px]">{formatGBP(materialsPrice)}</p>
              </li>
            </ul>
            <div className="px-3 py-2 border-t border-border bg-secondary/40 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="num">{formatGBP(subtotal)}</span>
              </div>
              {vatRegistered && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">VAT (20%)</span>
                  <span className="num">{formatGBP(vat)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between pt-1.5 mt-1 border-t border-border">
                <span className="text-[10px] uppercase tracking-widest font-semibold">Total</span>
                <span className="num text-xl text-ink">{formatGBP(total)}</span>
              </div>
            </div>
          </div>
        </section>

        {(terms?.trim() || profile.quote_footer?.trim()) && (
          <section className="px-4 mt-3 space-y-2">
            {terms?.trim() && (
              <div>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mb-0.5">
                  Payment terms
                </p>
                <p className="text-[11px] text-ink/80 whitespace-pre-line leading-snug">{terms}</p>
              </div>
            )}
            {profile.quote_footer?.trim() && (
              <p className="text-[11px] text-muted-foreground whitespace-pre-line leading-snug">
                {profile.quote_footer}
              </p>
            )}
          </section>
        )}

        {profile.show_signature && (
          <section className="px-4 mt-3 pb-4">
            <p className="font-serif italic text-muted-foreground text-[12px]">
              — {signatureName}
            </p>
          </section>
        )}
        {!profile.show_signature && <div className="pb-3" />}
      </div>
    </div>
  );
}

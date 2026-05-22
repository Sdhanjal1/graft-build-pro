import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, Building2, Phone, ImageIcon, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { TRADE_TYPES } from "@/lib/mock-data";
import { BusinessLogo } from "@/components/BusinessLogo";
import { toast } from "sonner";

export const Route = createFileRoute("/welcome")({
  component: WelcomePage,
});

type Profile = {
  full_name: string | null;
  business_name: string | null;
  trade_type: string | null;
  phone: string | null;
  logo_url: string | null;
};

function WelcomePage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile>({
    full_name: "",
    business_name: "",
    trade_type: "",
    phone: "",
    logo_url: "",
  });
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Bounce to auth if not signed in; skip wizard if already onboarded
  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth" });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, business_name, trade_type, phone, logo_url")
        .eq("id", session.user.id)
        .maybeSingle();
      if (data?.business_name && data?.trade_type) {
        navigate({ to: "/app" });
        return;
      }
      setProfile({
        full_name: data?.full_name ?? (session.user.user_metadata?.full_name as string ?? ""),
        business_name: data?.business_name ?? "",
        trade_type: data?.trade_type ?? "",
        phone: data?.phone ?? "",
        logo_url: data?.logo_url ?? "",
      });
      setChecking(false);
    })();
  }, [session, loading, navigate]);

  const save = async (patch: Partial<Profile>) => {
    if (!session) return;
    setProfile((p) => ({ ...p, ...patch }));
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", session.user.id);
    setSaving(false);
    if (error) toast.error("Couldn't save, try again");
  };

  const handleLogoUpload = async (file: File) => {
    if (!session) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${session.user.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
      await save({ logo_url: pub.publicUrl });
    } catch {
      toast.error("Couldn't upload logo");
    } finally {
      setUploading(false);
    }
  };

  const finish = () => navigate({ to: "/app" });

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-ink text-paper flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-lime" />
      </div>
    );
  }

  const steps = [
    { title: "Welcome", icon: CheckCircle2 },
    { title: "Trade", icon: BadgeCheck },
    { title: "Business", icon: Building2 },
    { title: "Phone", icon: Phone },
    { title: "Logo", icon: ImageIcon },
  ];

  return (
    <div className="min-h-screen bg-ink text-paper flex flex-col relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ background: "radial-gradient(circle at 50% 0%, color-mix(in oklab, var(--lime) 35%, transparent), transparent 55%)" }}
      />

      {/* Progress */}
      <div className="relative px-6 pt-8">
        <div className="max-w-md mx-auto flex gap-1.5">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-lime" : "bg-paper/15"}`} />
          ))}
        </div>
        <p className="max-w-md mx-auto mt-3 text-[10px] uppercase tracking-widest text-paper/50 font-semibold">
          Step {step + 1} of {steps.length}
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full relative pb-8">
        {step === 0 && (
          <StepShell
            title={`Welcome${profile.full_name ? ", " + profile.full_name.split(" ")[0] : ""} 👋`}
            subtitle="Let's get you set up in under 2 minutes so your first quote looks the part."
          >
            <ul className="space-y-3 mt-6 text-sm text-paper/80">
              {["Pick your trade", "Add your business name", "Add your mobile", "Upload your logo (optional)"].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="h-6 w-6 rounded-full bg-lime/20 text-lime flex items-center justify-center text-xs font-bold">✓</span>
                  {t}
                </li>
              ))}
            </ul>
            <PrimaryButton onClick={() => setStep(1)}>Let's go</PrimaryButton>
          </StepShell>
        )}

        {step === 1 && (
          <StepShell title="What's your trade?" subtitle="We'll tailor quote templates and AI prompts to your trade.">
            <div className="grid grid-cols-1 gap-2 mt-6 max-h-[55vh] overflow-y-auto pr-1">
              {TRADE_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => save({ trade_type: t })}
                  className={`text-left px-4 py-3.5 rounded-2xl border text-sm font-semibold transition-colors ${
                    profile.trade_type === t
                      ? "bg-lime text-ink border-lime"
                      : "bg-paper/5 border-paper/15 text-paper hover:bg-paper/10"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <PrimaryButton onClick={() => setStep(2)} disabled={!profile.trade_type}>
              Continue
            </PrimaryButton>
          </StepShell>
        )}

        {step === 2 && (
          <StepShell title="What's your business name?" subtitle="This shows on every quote and invoice you send.">
            <input
              autoFocus
              value={profile.business_name ?? ""}
              onChange={(e) => setProfile((p) => ({ ...p, business_name: e.target.value }))}
              onBlur={() => save({ business_name: profile.business_name })}
              placeholder="e.g. Smith Plumbing Ltd"
              className="mt-6 w-full bg-paper/10 border border-paper/15 rounded-2xl px-4 py-4 text-base outline-none focus:border-lime/50 placeholder:text-paper/30"
            />
            <PrimaryButton
              onClick={async () => { await save({ business_name: profile.business_name }); setStep(3); }}
              disabled={!profile.business_name?.trim()}
            >
              Continue
            </PrimaryButton>
          </StepShell>
        )}

        {step === 3 && (
          <StepShell title="Your mobile number?" subtitle="Customers will call this back. We never share it.">
            <input
              autoFocus
              type="tel"
              value={profile.phone ?? ""}
              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
              onBlur={() => save({ phone: profile.phone })}
              placeholder="07123 456789"
              className="mt-6 w-full bg-paper/10 border border-paper/15 rounded-2xl px-4 py-4 text-base outline-none focus:border-lime/50 placeholder:text-paper/30"
            />
            <PrimaryButton
              onClick={async () => { await save({ phone: profile.phone }); setStep(4); }}
              disabled={!profile.phone?.trim()}
            >
              Continue
            </PrimaryButton>
          </StepShell>
        )}

        {step === 4 && (
          <StepShell title="Add your logo" subtitle="Optional but makes quotes look 10× more professional.">
            <div className="mt-6 flex flex-col items-center gap-4">
              <BusinessLogo logoUrl={profile.logo_url ?? undefined} businessName={profile.business_name ?? "B"} size="xl" />
              <label className="cursor-pointer bg-paper/10 border border-paper/15 rounded-full px-5 py-2.5 text-sm font-semibold hover:bg-paper/15">
                {uploading ? "Uploading…" : profile.logo_url ? "Replace logo" : "Upload logo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLogoUpload(f);
                  }}
                />
              </label>
            </div>

            <div className="mt-8 space-y-2">
              <PrimaryButton onClick={finish}>
                {profile.logo_url ? "Finish, open Quottr" : "Finish, I'll add later"}
              </PrimaryButton>
              {!profile.logo_url && (
                <button onClick={finish} className="w-full text-xs text-paper/50 py-2">
                  Skip for now
                </button>
              )}
            </div>
          </StepShell>
        )}
      </div>

      {saving && (
        <div className="absolute top-4 right-4 text-[10px] text-paper/40 flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving
        </div>
      )}
    </div>
  );
}

function StepShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2.25rem, 8vw, 3rem)", letterSpacing: "0.01em" }}>
        {title}
      </h1>
      <p className="text-paper/60 text-sm mt-2 leading-relaxed">{subtitle}</p>
      {children}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-lime text-ink rounded-full py-4 font-bold mt-6 disabled:opacity-40 flex items-center justify-center gap-2"
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </button>
  );
}

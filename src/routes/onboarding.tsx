import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ArrowRight, Check, Loader2, Wrench, Zap, Hammer, Home, PaintRoller, Flame, HardHat, MoreHorizontal } from "lucide-react";
import { useSession } from "@/lib/auth";
import { userProfile, hydrateUserData, saveProfileToCloud } from "@/lib/user-data";
import { feedback } from "@/lib/feedback";
import { QuottrWordmark } from "@/components/QuottrLogo";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingWizard,
  head: () => ({
    meta: [
      { title: "Welcome to Quottr" },
      { name: "description", content: "Seven quick questions to set up your account." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const TRADES = [
  { id: "Plumber", icon: Wrench },
  { id: "Electrician", icon: Zap },
  { id: "Builder", icon: HardHat },
  { id: "Roofer", icon: Home },
  { id: "Carpenter", icon: Hammer },
  { id: "Decorator", icon: PaintRoller },
  { id: "Gas Engineer", icon: Flame },
  { id: "Other", icon: MoreHorizontal },
];

const TOTAL_STEPS = 5;

function formatUKPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 5) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return `${digits.slice(0, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
}

function OnboardingWizard() {
  const { session, loading, user } = useSession();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [ready, setReady] = useState(false);
  const [savingStep, setSavingStep] = useState(false);

  // Form state
  const [trade, setTrade] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [vat, setVat] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/auth" });
      return;
    }
    if (!session) return;
    (async () => {
      await hydrateUserData();
      setTrade(userProfile.trade_type || "");
      setBusinessName(userProfile.business_name || "");
      const authName =
        (user?.user_metadata as { full_name?: string } | undefined)?.full_name || "";
      setFullName(userProfile.full_name || authName);
      setPhone(formatUKPhone(userProfile.phone || ""));
      setVat(!!userProfile.vat_registered);
      // If already onboarded, jump them to the app.
      if (userProfile.business_name) {
        navigate({ to: "/app" });
        return;
      }
      setReady(true);
    })();
  }, [loading, session, user, navigate]);

  if (!ready) {
    return <div className="min-h-screen bg-ink" />;
  }

  const goNext = async (patch?: Partial<typeof userProfile>) => {
    setSavingStep(true);
    try {
      if (patch) await saveProfileToCloud(patch);
      feedback("tap");
      setStep((s) => Math.min(TOTAL_STEPS + 1, s + 1));
    } catch (e) {
      feedback("error");
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSavingStep(false);
    }
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));


  const finish = () => {
    feedback("success");
    navigate({ to: "/quotes/new", search: { voice: 1 } as never });
  };

  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValid = phoneDigits.length >= 10;

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {step <= TOTAL_STEPS && (
        <header className="px-5 pt-7">
          <QuottrWordmark className="text-2xl text-ink" />
          <div className="mt-5 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-lime transition-all duration-300"
                style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
              />
            </div>
            <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
              {step}/{TOTAL_STEPS}
            </span>
          </div>
        </header>
      )}

      <main className="flex-1 px-5 pt-8 pb-10 flex flex-col">
        {step === 1 && (
          <StepShell>
            <h1 className="text-4xl leading-tight">7 quick questions. Then quote in seconds.</h1>
            <p className="mt-3 text-base text-muted-foreground">
              Set up once, then every quote takes nine seconds.
            </p>
            <PrimaryButton onClick={() => goNext()} busy={savingStep}>
              Let's go
            </PrimaryButton>
          </StepShell>
        )}

        {step === 2 && (
          <StepShell>
            <h2 className="text-3xl leading-tight">What's your trade?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Tap one — you can change it later.</p>
            <div className="mt-6 grid grid-cols-2 gap-2.5">
              {TRADES.map((t) => {
                const Icon = t.icon;
                const active = trade === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      feedback("tap");
                      setTrade(t.id);
                    }}
                    aria-pressed={active}
                    className={`relative rounded-[var(--radius-lg)] px-4 py-5 flex flex-col items-center gap-2 transition active:scale-95 ${
                      active
                        ? "bg-lime text-ink ring-2 ring-ink shadow-[0_8px_24px_-8px_rgba(200,224,74,0.7)]"
                        : "card-surface"
                    }`}
                  >
                    {active && (
                      <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-ink flex items-center justify-center">
                        <Check className="h-3 w-3 text-lime" strokeWidth={4} />
                      </span>
                    )}
                    <Icon className={`h-6 w-6 ${active ? "text-ink" : "text-ink"}`} />
                    <span className="text-sm font-semibold text-ink">{t.id}</span>
                  </button>
                );
              })}
            </div>
            <PrimaryButton
              onClick={() => goNext({ trade_type: trade })}
              busy={savingStep}
              disabled={!trade}
            >
              Continue
            </PrimaryButton>
            <BackButton onClick={goBack} />
          </StepShell>
        )}

        {step === 3 && (
          <StepShell>
            <h2 className="text-3xl leading-tight">Tell us about you.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your business name shows on quotes. Your name shows when you message customers.
            </p>
            <div className="mt-6 space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                  Business name
                </label>
                <input
                  autoFocus
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Cosy Plumbing & Heating"
                  className="mt-1 w-full bg-card border border-border rounded-2xl px-4 py-4 text-base outline-none focus:ring-2 focus:ring-lime"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                  Your name
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                  className="mt-1 w-full bg-card border border-border rounded-2xl px-4 py-4 text-base outline-none focus:ring-2 focus:ring-lime"
                />
              </div>
            </div>
            <PrimaryButton
              onClick={() =>
                goNext({
                  business_name: businessName.trim(),
                  full_name: fullName.trim(),
                })
              }
              busy={savingStep}
              disabled={!businessName.trim() || !fullName.trim()}
            >
              Continue
            </PrimaryButton>
            <BackButton onClick={goBack} />
          </StepShell>
        )}

        {step === 4 && (
          <StepShell>
            <h2 className="text-3xl leading-tight">Mobile number?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              So we can text you a code if you ever get locked out.
            </p>
            <input
              autoFocus
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(formatUKPhone(e.target.value))}
              placeholder="07XXX XXX XXX"
              className="mt-6 w-full bg-card border border-border rounded-2xl px-4 py-4 text-base outline-none focus:ring-2 focus:ring-lime tracking-wide"
            />
            <PrimaryButton
              onClick={() => goNext({ phone: phone.trim() })}
              busy={savingStep}
              disabled={!phoneValid}
            >
              Continue
            </PrimaryButton>
            <BackButton onClick={goBack} />
          </StepShell>
        )}

        {step === 5 && (
          <StepShell>
            <h2 className="text-3xl leading-tight">VAT registered?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Most sole traders earning under £90,000/year are NOT VAT registered.
              If you're unsure, leave this off — you can change it later.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <ToggleCard
                active={vat === false}
                onClick={() => {
                  feedback("tap");
                  setVat(false);
                }}
                title="No"
                sub="Quotes show net totals"
              />
              <ToggleCard
                active={vat === true}
                onClick={() => {
                  feedback("tap");
                  setVat(true);
                }}
                title="Yes"
                sub="Add 20% VAT to quotes"
              />
            </div>
            <PrimaryButton
              onClick={() => goNext({ vat_registered: vat })}
              busy={savingStep}
            >
              Continue
            </PrimaryButton>
            <BackButton onClick={goBack} />
          </StepShell>
        )}



        {step === TOTAL_STEPS + 1 && (
          <StepShell>
            <div className="h-16 w-16 rounded-full bg-lime flex items-center justify-center mb-5">
              <Check className="h-8 w-8 text-ink" strokeWidth={3} />
            </div>
            <h2 className="text-4xl leading-tight">You're ready.</h2>
            <p className="mt-3 text-base text-muted-foreground">
              Tap below to talk through your first job — your quote will be ready in nine seconds.
            </p>
            <PrimaryButton onClick={finish}>
              Generate my first quote
            </PrimaryButton>
            <Link
              to="/app"
              className="mt-3 w-full text-center text-sm font-semibold text-muted-foreground py-3"
            >
              I'll explore first
            </Link>
          </StepShell>
        )}
      </main>
    </div>
  );
}

function StepShell({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col flex-1 max-w-md mx-auto w-full">{children}</div>;
}

function PrimaryButton({
  children,
  onClick,
  busy,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="mt-8 w-full bg-lime text-ink rounded-full py-4 font-bold inline-flex items-center justify-center gap-2 active:scale-[0.99] transition disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
      {children}
      {!busy ? <ArrowRight className="h-4 w-4" /> : null}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 w-full text-sm text-muted-foreground py-3"
    >
      Back
    </button>
  );
}

function ToggleCard({
  active,
  onClick,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative rounded-[var(--radius-lg)] px-4 py-5 text-left transition active:scale-95 ${
        active
          ? "bg-lime text-ink ring-2 ring-ink shadow-[0_8px_24px_-8px_rgba(200,224,74,0.7)]"
          : "card-surface"
      }`}
    >
      {active && (
        <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-ink flex items-center justify-center">
          <Check className="h-3 w-3 text-lime" strokeWidth={4} />
        </span>
      )}
      <p className="text-2xl font-bold text-ink">{title}</p>
      <p className={`text-[11px] mt-1 ${active ? "text-ink/70" : "text-muted-foreground"}`}>{sub}</p>
    </button>
  );
}

function FeatureLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="h-4 w-4 text-lime mt-0.5 shrink-0" />
      <span className="text-ink">{children}</span>
    </li>
  );
}

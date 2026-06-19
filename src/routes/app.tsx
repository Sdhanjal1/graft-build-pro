import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/AppShell";
import {
  userProfile, stats, formatGBP, getClient, mockQuotes,
  todaysJobs, formatTime, getQuote, materialsForQuote,
} from "@/lib/user-data";
import { resolveTrade } from "@/lib/trades";
import { ArrowRight, FileText, Bell, AlertTriangle, Clock, Send, Settings, CreditCard, X, CheckCircle2, ShoppingCart } from "lucide-react";
import { VoiceWaveform } from "@/components/icons/VoiceIcons";


import { BusinessLogo } from "@/components/BusinessLogo";
import { RotatingPrompts } from "@/components/RotatingPrompts";
import { useSession } from "@/lib/auth";
import { HomeSkeleton } from "@/components/Skeletons";

const STRIPE_BANNER_DISMISS_KEY = "quottr.dismiss.connect_stripe_banner_until";
const STRIPE_BANNER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function greetingFor(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Evening";
}

function buzz(ms = 10) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try { navigator.vibrate(ms); } catch { /* noop */ }
  }
}

export const Route = createFileRoute("/app")({
  component: AppHomePage,
  validateSearch: (s: Record<string, unknown>) => ({
    firstRun: s.firstRun === 1 || s.firstRun === "1" ? 1 : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Quottr app" },
      { name: "description", content: "Tap to start a quote. See what you're owed at a glance." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AppHomePage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const { firstRun } = Route.useSearch();
  const [bannerDismissed, setBannerDismissed] = useState(true);
  const [showFirstRun, setShowFirstRun] = useState(false);
  const micCardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(STRIPE_BANNER_DISMISS_KEY);
      // Legacy permanent dismiss ("1") is ignored — banner returns until Stripe is connected.
      const until = raw && raw !== "1" ? Number(raw) : 0;
      setBannerDismissed(Number.isFinite(until) && until > Date.now());
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (firstRun && window.localStorage.getItem("firstRunSeen") !== "true") {
      setShowFirstRun(true);
      window.localStorage.setItem(
        "quottr.pwa-dismissed-until",
        String(Date.now() + 30 * 60 * 1000),
      );
      requestAnimationFrame(() => {
        micCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [firstRun]);

  const dismissFirstRun = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("firstRunSeen", "true");
    }
    setShowFirstRun(false);
    navigate({ to: "/app", search: {}, replace: true });
  };

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (loading || !session) return;
    if (!userProfile.business_name) {
      navigate({ to: "/onboarding" });
    }
  }, [loading, session, navigate]);

  if (loading || !session) {
    return <HomeSkeleton />;
  }

  const s = stats();
  const today = todaysJobs();
  const firstName = userProfile.full_name.split(" ")[0] || "there";
  const greeting = greetingFor();

  // Action-queue breakdown
  const pendingQuotes = mockQuotes.filter((q) => q.status === "pending");
  const acceptedQuotes = mockQuotes.filter((q) => q.status === "accepted");
  const sentQuotes = mockQuotes.filter((q) => q.status === "sent");
  const overdueQuotes = mockQuotes.filter((q) => q.status === "overdue");

  const pendingTotal = pendingQuotes.reduce((sum, q) => sum + q.total, 0);
  const acceptedTotal = acceptedQuotes.reduce((sum, q) => sum + q.total, 0);
  const awaitingReplyTotal = sentQuotes.reduce((sum, q) => sum + q.total, 0);
  const overdueTotal = overdueQuotes.reduce((sum, q) => sum + q.total, 0);

  const hasActions =
    pendingQuotes.length > 0 ||
    acceptedQuotes.length > 0 ||
    sentQuotes.length > 0 ||
    overdueQuotes.length > 0;

  // Single hero number: paid > owed > won > nothing.
  const hero: { label: string; amount: number; href?: string; sub?: React.ReactNode } | null =
    s.paidTodayCount > 0
      ? {
          label: "Paid today",
          amount: s.paidToday,
          sub: (
            <>
              {s.paidTodayCount} payment{s.paidTodayCount !== 1 ? "s" : ""}
              {s.outstanding > 0 && (
                <>
                  {" · "}
                  <Link to="/chaser" className="text-paper/80 hover:text-lime underline-offset-2 hover:underline">
                    You are owed {formatGBP(s.outstanding)}
                  </Link>
                </>
              )}
            </>
          ),
        }
      : s.outstanding > 0
      ? {
          label: "You are owed",
          amount: s.outstanding,
          href: "/chaser",
          sub:
            s.acceptedTodayCount > 0 ? (
              <span className="text-lime">Won today: {formatGBP(s.acceptedTodayAmount)}</span>
            ) : null,
        }
      : s.acceptedTodayCount > 0
      ? { label: "Won today", amount: s.acceptedTodayAmount }
      : null;

  // Action cards in priority order
  const cards: Array<{ to: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; tone: "pending" | "neutral" | "overdue" | "accepted"; title: string; count: number; amount: number; cta: string }> = [];
  if (overdueQuotes.length > 0) cards.push({ to: "/chaser", icon: AlertTriangle, tone: "overdue", title: "Overdue", count: overdueQuotes.length, amount: overdueTotal, cta: "Send reminder" });
  if (pendingQuotes.length > 0) cards.push({ to: "/quotes", icon: Send, tone: "pending", title: "Quotes to send", count: pendingQuotes.length, amount: pendingTotal, cta: "Send now" });
  if (acceptedQuotes.length > 0) cards.push({ to: "/quotes", icon: CheckCircle2, tone: "accepted", title: "Booked jobs", count: acceptedQuotes.length, amount: acceptedTotal, cta: "Mark complete" });
  if (sentQuotes.length > 0) cards.push({ to: "/chaser", icon: Bell, tone: "neutral", title: "Awaiting reply", count: sentQuotes.length, amount: awaitingReplyTotal, cta: "Chase up" });

  const bookedWithMats = mockQuotes
    .filter((q) => q.status === "accepted")
    .map((q) => ({ q, mats: materialsForQuote(q) }))
    .filter(({ mats }) => mats.length > 0);
  const totalMatItems = bookedWithMats.reduce((sum, { mats }) => sum + mats.length, 0);

  const showStripeBanner = mockQuotes.length > 0 && !userProfile.stripe_connected && !bannerDismissed;

  return (
    <AppShell>
      <div className="flex flex-col min-h-[calc(100dvh-7rem)]">
        {/* Ink header: greeting + hero £ */}
        <header className="bg-surface text-paper rounded-b-[1.5rem] px-5 pt-6 pb-7 relative overflow-hidden">
          <span aria-hidden className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-lime/15 blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <BusinessLogo logoUrl={userProfile.logo_url} businessName={userProfile.business_name} size="md" />
              <div className="min-w-0">
                <p className="text-lg font-semibold text-paper leading-tight truncate">{greeting}, {firstName}</p>
                <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] font-bold text-paper/55 truncate">
                  {userProfile.business_name || "Set up your business"}
                </p>
              </div>
            </div>
            <Link
              to="/settings"
              aria-label="Open settings"
              className="h-10 w-10 shrink-0 grid place-items-center rounded-full bg-paper/10 ring-1 ring-paper/15 text-paper/80 hover:text-lime hover:bg-paper/15 active:text-lime transition"
            >
              <Settings className="h-5 w-5" />
            </Link>
          </div>

          {hero && <HeroNumber {...hero} />}
        </header>

        {/* Action queue — leads the feed */}
        {hasActions && (
          <section className="px-5 mt-5 space-y-2.5">
            {cards.map((c, i) => (
              <ActionCard key={c.title} {...c} hero={i === 0} />
            ))}
          </section>
        )}

        {/* Today's jobs */}
        {today.length > 0 && (
          <section className="px-5 mt-5">
            <div className="card-surface p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-lime" />
                <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                  Today's jobs
                </p>
              </div>
              <div className="space-y-2">
                {today.map((j) => {
                  const q = getQuote(j.quote_id);
                  const c = q ? getClient(q.client_id) : undefined;
                  if (!q) return null;
                  return (
                    <Link
                      key={j.id}
                      to="/quotes/$quoteId"
                      params={{ quoteId: q.id }}
                      className="flex items-center gap-3 active:scale-[0.99] transition"
                    >
                      <div className="num text-lg text-ink leading-none w-16 shrink-0 tabular-nums">
                        {formatTime(j.starts_at)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{q.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c?.name} · {c?.address}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Voice-first hero CTA — big central mic */}
        <section ref={micCardRef} id="home-mic-card" className="px-5 mt-5 flex-1 flex flex-col scroll-mt-20">
          {showFirstRun && (
            <div className="relative mb-3 rounded-2xl bg-lime text-ink p-4 shadow-[0_10px_28px_-12px_rgba(0,0,0,0.35)] ring-1 ring-ink/10">
              <button
                type="button"
                onClick={dismissFirstRun}
                aria-label="Dismiss"
                className="absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center hover:bg-ink/10 active:scale-95"
              >
                <X className="h-4 w-4 text-ink" strokeWidth={2.5} />
              </button>
              <p className="text-sm font-semibold pr-7">
                Welcome, {firstName}. Tap the mic to speak your first quote.
              </p>
              <p className="mt-1 text-xs text-ink/75">
                Try: &ldquo;{resolveTrade(userProfile.trade_type).homeMicExample}&rdquo;
              </p>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={dismissFirstRun}
                  className="rounded-full bg-ink text-paper text-xs font-semibold px-4 py-2 active:scale-95"
                >
                  Got it
                </button>
              </div>
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rotate-45 bg-lime ring-1 ring-ink/10" />
            </div>
          )}
          <div className="flex flex-col w-full rounded-2xl bg-surface text-paper p-5 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.5)] text-center flex-1">
            <Link
              to="/quotes/new"
              search={{ voice: 1 }}
              onClick={() => buzz(12)}
              className="flex flex-col items-center justify-center flex-1 active:scale-[0.99] transition rounded-2xl py-2"
            >
              <p className="text-[10px] uppercase tracking-widest text-paper/60 font-semibold">
                Tap to start
              </p>
              <p className="text-2xl font-semibold leading-tight mt-1">New voice quote</p>

              <div className="flex items-center justify-center my-3">
                <span className="relative h-32 w-32 rounded-full bg-lime flex items-center justify-center shadow-[0_20px_48px_-14px_rgba(200,224,74,0.8)]">
                  <span className="absolute inset-0 rounded-full bg-lime mic-ring-inner origin-center" />
                  <span className="absolute inset-0 rounded-full bg-lime mic-ring-outer origin-center" />
                  <VoiceWaveform size={64} className="relative text-ink" />
                </span>
              </div>
            </Link>

            <div className="pt-3 mt-auto border-t border-paper/10">
              <p className="text-[10px] uppercase tracking-widest text-paper/40 font-semibold">
                Try saying
              </p>
              <RotatingPrompts className="mt-1 text-sm text-paper/85 leading-snug" />
              <Link
                to="/quotes/new"
                search={{ type: 1 }}
                className="inline-block mt-3 text-xs text-paper/60 hover:text-lime underline underline-offset-4 decoration-paper/30"
              >
                Or type instead
              </Link>
            </div>
          </div>
        </section>

        {/* Materials needed across all booked jobs */}
        {totalMatItems > 0 && (
          <section className="px-5 mt-4">
            <Link
              to="/quotes"
              className="card-surface p-4 flex items-center gap-3 active:scale-[0.99] transition"
            >
              <div className="h-10 w-10 rounded-full bg-lime flex items-center justify-center shrink-0">
                <ShoppingCart className="h-5 w-5 text-ink" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                  Materials needed
                </p>
                <p className="text-sm font-semibold mt-0.5">
                  {totalMatItems} item{totalMatItems === 1 ? "" : "s"} across {bookedWithMats.length} booked job{bookedWithMats.length === 1 ? "" : "s"}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </section>
        )}


        {/* Connect Stripe banner: after first quote, until connected or dismissed */}
        {showStripeBanner && (
          <section className="px-5 mt-4">
            <div className="card-surface p-3 flex items-center gap-3 border-l-4 border-lime">
              <div className="h-10 w-10 rounded-full bg-lime/15 flex items-center justify-center shrink-0">
                <CreditCard className="h-5 w-5 text-ink" />
              </div>
              <Link
                to="/settings"
                className="flex-1 min-w-0 active:opacity-80 transition"
              >
                <p className="text-sm font-semibold text-ink">Take card payments.</p>
                <p className="text-[11px] text-muted-foreground">
                  Get paid on the spot.
                </p>
              </Link>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem(
                      STRIPE_BANNER_DISMISS_KEY,
                      String(Date.now() + STRIPE_BANNER_SNOOZE_MS),
                    );
                  }
                  setBannerDismissed(true);
                }}
                className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-ink active:scale-95 transition shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

/* ---------- Sub-components ---------- */

function HeroNumber({
  label,
  amount,
  href,
  sub,
}: {
  label: string;
  amount: number;
  href?: string;
  sub?: React.ReactNode;
}) {
  const numberEl = (
    <p
      className="money-hero text-lime leading-[0.82] tabular-nums"
      style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(3.5rem, 18vw, 6rem)" }}
    >
      <span className="num-appear inline-block">{formatGBP(amount)}</span>
    </p>
  );
  return (
    <div className="relative mt-2">
      <p className="text-[10px] uppercase tracking-[0.2em] text-lime font-bold">{label}</p>
      <div className="mt-1">
        {href ? (
          <Link to={href} className="block active:opacity-80 transition">
            {numberEl}
          </Link>
        ) : (
          numberEl
        )}
      </div>
      {sub && <p className="text-[11px] text-paper/60 font-medium mt-2">{sub}</p>}
    </div>
  );
}

function ActionCard({
  to,
  icon: Icon,
  tone,
  title,
  count,
  amount,
  cta,
  hero = false,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: "pending" | "neutral" | "overdue" | "accepted";
  title: string;
  count: number;
  amount: number;
  cta: string;
  hero?: boolean;
}) {
  if (hero) {
    // Distinct surface per tone so the queue's mood reads at a glance.
    const heroBg =
      tone === "overdue"
        ? "bg-status-overdue text-paper"
        : tone === "accepted"
        ? "bg-lime text-ink"
        : tone === "pending"
        ? "bg-ink text-paper"
        : "bg-paper text-ink ring-1 ring-border";
    const onLight = tone === "accepted" || tone === "neutral";
    const amountColor = onLight ? "text-ink" : "text-lime";
    const subColor = onLight ? "text-ink/70" : "text-paper/65";
    const eyebrowColor =
      tone === "accepted"
        ? "text-ink/60"
        : tone === "neutral"
        ? "text-ink/50"
        : "text-lime";
    const ctaColor = onLight ? "text-ink" : "text-lime";
    const iconColor = onLight ? "text-ink/70" : "text-paper/70";
    return (
      <Link
        to={to}
        className={`block rounded-2xl ${heroBg} p-5 active:scale-[0.99] transition shadow-[0_12px_28px_-14px_rgba(0,0,0,0.45)]`}
      >
        <div className="flex items-center justify-between">
          <p className={`text-[10px] uppercase tracking-[0.2em] font-bold ${eyebrowColor}`}>{title}</p>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <p
          className={`mt-2 leading-[0.85] tabular-nums ${amountColor}`}
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(3rem, 13vw, 4.5rem)" }}
        >
          {formatGBP(amount)}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <p className={`text-xs font-medium ${subColor}`}>
            {count} quote{count !== 1 ? "s" : ""}
          </p>
          <span className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider ${ctaColor}`}>
            {cta} <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </Link>
    );
  }

  const borderCls =
    tone === "pending"
      ? "border-l-4 border-status-pending"
      : tone === "overdue"
      ? "border-l-4 border-status-overdue"
      : tone === "accepted"
      ? "border-l-4 border-lime"
      : "border-l-4 border-paper/30";

  const iconBg =
    tone === "pending"
      ? "bg-status-pending/15"
      : tone === "overdue"
      ? "bg-status-overdue/15"
      : tone === "accepted"
      ? "bg-lime/15"
      : "bg-paper/10";

  const iconColor =
    tone === "pending"
      ? "text-status-pending"
      : tone === "overdue"
      ? "text-status-overdue"
      : "text-ink";

  return (
    <Link
      to={to}
      className={`card-surface p-3 flex items-center gap-3 active:scale-[0.99] transition ${borderCls}`}
    >
      <div className={`h-10 w-10 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-ink leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {count} quote{count !== 1 ? "s" : ""} · <span className="tabular-nums font-semibold text-ink">{formatGBP(amount)}</span>
        </p>
      </div>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink shrink-0">
        {cta}
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

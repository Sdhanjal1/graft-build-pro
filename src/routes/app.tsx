import { createFileRoute, Link, useNavigate, ClientOnly } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import CountUp from "react-countup";
import { AppShell } from "@/components/AppShell";
import {
  userProfile, stats, formatGBP, getClient, mockQuotes,
  todaysJobs, formatTime, getQuote, materialsForQuote,
} from "@/lib/user-data";
import { resolveTrade } from "@/lib/trades";
import { Mic, ArrowRight, FileText, Bell, AlertTriangle, Clock, Send, Settings, CreditCard, X, CheckCircle2, ShoppingCart } from "lucide-react";


import { QuottrWordmark } from "@/components/QuottrLogo";
import { RotatingPrompts } from "@/components/RotatingPrompts";
import { useSession } from "@/lib/auth";
import { HomeSkeleton } from "@/components/Skeletons";

const STRIPE_BANNER_DISMISS_KEY = "quottr.dismiss.connect_stripe_banner";

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

// Mic-example copy is sourced from the trade registry — see src/lib/trades.ts.


function AppHomePage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const { firstRun } = Route.useSearch();
  const [bannerDismissed, setBannerDismissed] = useState(true);
  const [showFirstRun, setShowFirstRun] = useState(false);
  const micCardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBannerDismissed(window.localStorage.getItem(STRIPE_BANNER_DISMISS_KEY) === "1");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (firstRun && window.localStorage.getItem("firstRunSeen") !== "true") {
      setShowFirstRun(true);
      // Snooze the PWA install banner for 30 minutes so the first-run
      // tooltip stands alone on the mic. The PWA prompt can return later.
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

  return (
    <AppShell>
      <div className="flex flex-col min-h-[calc(100dvh-7rem)]">
      {/* Ink header: greeting + £ outstanding */}

      <header className="bg-ink text-paper rounded-b-3xl px-5 pt-5 pb-5">
        <div className="flex items-center justify-between">
          <QuottrWordmark className="text-3xl" />
          <Link
            to="/settings"
            className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-paper/60 hover:text-lime transition max-w-[55%]"
          >
            <span className="truncate">{userProfile.business_name || "Set up"}</span>
            <Settings className="h-3.5 w-3.5 shrink-0" />
          </Link>
        </div>

        <p className="mt-5 text-sm text-paper/70 font-medium">
          {greeting}, {firstName}
        </p>

        {s.paidTodayCount > 0 ? (
          <div className="mt-1">
            <p className="text-[10px] uppercase tracking-widest text-paper/60 font-semibold">
              Paid today
            </p>
            <p className="num text-6xl leading-none text-lime mt-1">
              <ClientOnly fallback={<>{formatGBP(s.paidToday)}</>}>
                <CountUp start={0} end={s.paidToday} duration={0.6} formattingFn={formatGBP} />
              </ClientOnly>
            </p>
            <p className="text-[11px] text-paper/60 font-medium mt-1">
              {s.paidTodayCount} payment{s.paidTodayCount !== 1 ? "s" : ""}
              {s.outstanding > 0 && (
                <>
                  {" · "}
                  <Link to="/chaser" className="text-paper/80 hover:text-lime underline-offset-2 hover:underline">
                    You are owed {formatGBP(s.outstanding)}
                  </Link>
                </>
              )}
            </p>
          </div>
        ) : s.outstanding > 0 ? (
          <div className="mt-1">
            {s.acceptedTodayCount > 0 && (
              <p className="text-sm text-lime font-semibold mb-1">
                Won today: {formatGBP(s.acceptedTodayAmount)}
              </p>
            )}
            <p className="text-[10px] uppercase tracking-widest text-paper/60 font-semibold">
              You are owed
            </p>
            <Link to="/chaser" className="block mt-1 active:opacity-80 transition">
              <p className="num text-6xl leading-none text-lime">
                <ClientOnly fallback={<>{formatGBP(s.outstanding)}</>}>
                  <CountUp start={0} end={s.outstanding} duration={0.6} formattingFn={formatGBP} />
                </ClientOnly>
              </p>
            </Link>
          </div>
        ) : s.acceptedTodayCount > 0 ? (
          <div className="mt-1">
            <p className="text-[10px] uppercase tracking-widest text-paper/60 font-semibold">
              Won today
            </p>
            <p className="num text-6xl leading-none text-lime mt-1">
              <ClientOnly fallback={<>{formatGBP(s.acceptedTodayAmount)}</>}>
                <CountUp start={0} end={s.acceptedTodayAmount} duration={0.6} formattingFn={formatGBP} />
              </ClientOnly>
            </p>
          </div>
        ) : null}

        {/* Stat pills */}
        {hasActions && (
          <div className="mt-4 flex gap-2 flex-wrap">
            {pendingQuotes.length > 0 && (
              <StatPill icon={FileText} count={pendingQuotes.length} label="to send" tone="pending" to="/quotes" />
            )}
            {acceptedQuotes.length > 0 && (
              <StatPill icon={CheckCircle2} count={acceptedQuotes.length} label="booked" tone="accepted" to="/quotes" />
            )}
            {sentQuotes.length > 0 && (
              <StatPill icon={Clock} count={sentQuotes.length} label="awaiting reply" tone="neutral" to="/chaser" />
            )}
            {overdueQuotes.length > 0 && (
              <StatPill icon={AlertTriangle} count={overdueQuotes.length} label="overdue" tone="overdue" to="/chaser" />
            )}
          </div>
        )}
      </header>

      {/* Materials needed across all booked jobs */}
      {(() => {
        const bookedWithMats = mockQuotes
          .filter((q) => q.status === "accepted")
          .map((q) => ({ q, mats: materialsForQuote(q) }))
          .filter(({ mats }) => mats.length > 0);
        const totalItems = bookedWithMats.reduce((s, { mats }) => s + mats.length, 0);
        if (totalItems === 0) return null;
        return (
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
                  {totalItems} item{totalItems === 1 ? "" : "s"} across {bookedWithMats.length} booked job{bookedWithMats.length === 1 ? "" : "s"}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </section>
        );
      })()}


      {/* Connect Stripe banner: after first quote, until connected or dismissed */}
      {mockQuotes.length > 0 && !userProfile.stripe_connected && !bannerDismissed && (
        <section className="px-5 mt-4">
          <div className="card-surface p-3 flex items-center gap-3 border-l-4 border-lime">
            <div className="h-10 w-10 rounded-full bg-lime/15 flex items-center justify-center shrink-0">
              <CreditCard className="h-5 w-5 text-ink" />
            </div>
            <Link
              to="/settings"
              className="flex-1 min-w-0 active:opacity-80 transition"
            >
              <p className="text-sm font-semibold text-ink">Take card payments</p>
              <p className="text-[11px] text-muted-foreground">
                Connect Stripe in 60 seconds.
              </p>
            </Link>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.localStorage.setItem(STRIPE_BANNER_DISMISS_KEY, "1");
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


      {/* Action queue cards */}
      {hasActions ? (
        <section className="px-5 mt-4 space-y-2">
          {pendingQuotes.length > 0 && (
            <ActionCard
              to="/quotes"
              icon={Send}
              tone="pending"
              title="Quotes to send"
              count={pendingQuotes.length}
              amount={pendingTotal}
              cta="Send now"
            />
          )}
          {acceptedQuotes.length > 0 && (
            <ActionCard
              to="/quotes"
              icon={CheckCircle2}
              tone="accepted"
              title="Accepted — book in"
              count={acceptedQuotes.length}
              amount={acceptedTotal}
              cta="Schedule"
            />
          )}
          {sentQuotes.length > 0 && (
            <ActionCard
              to="/chaser"
              icon={Bell}
              tone="neutral"
              title="Awaiting reply"
              count={sentQuotes.length}
              amount={awaitingReplyTotal}
              cta="Chase up"
            />
          )}
          {overdueQuotes.length > 0 && (
            <ActionCard
              to="/chaser"
              icon={AlertTriangle}
              tone="overdue"
              title="Overdue"
              count={overdueQuotes.length}
              amount={overdueTotal}
              cta="Send reminder"
            />
          )}
        </section>
      ) : null}


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
                    <div className="num text-lg text-ink leading-none w-14 shrink-0">
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
            {/* downward caret */}
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rotate-45 bg-lime ring-1 ring-ink/10" />
          </div>
        )}
        <div className="flex flex-col w-full rounded-3xl bg-ink text-paper p-5 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.5)] text-center flex-1">
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
                <Mic className="relative h-16 w-16 text-ink" strokeWidth={2.5} />
              </span>
            </div>
          </Link>

          <div className="pt-3 mt-auto border-t border-paper/10">
            <p className="text-[10px] uppercase tracking-widest text-paper/40 font-semibold">
              Try saying
            </p>
            <RotatingPrompts className="mt-1 text-sm text-paper/85 leading-snug" />
          </div>
        </div>
      </section>




      </div>
    </AppShell>

  );
}

/* ---------- Sub-components ---------- */

function StatPill({
  icon: Icon,
  count,
  label,
  tone,
  to,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  count: number;
  label: string;
  tone: "pending" | "neutral" | "overdue" | "accepted";
  to: string;
}) {
  const toneCls =
    tone === "pending"
      ? "bg-status-pending/20 text-status-pending"
      : tone === "overdue"
      ? "bg-status-overdue/20 text-status-overdue"
      : tone === "accepted"
      ? "bg-lime/20 text-lime"
      : "bg-paper/10 text-paper/80";
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold active:opacity-80 transition ${toneCls}`}
    >
      <Icon className="h-3 w-3" />
      {count} {label}
    </Link>
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
}: {
  to: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: "pending" | "neutral" | "overdue" | "accepted";
  title: string;
  count: number;
  amount: number;
  cta: string;
}) {
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
          {count} quote{count !== 1 ? "s" : ""} · {formatGBP(amount)}
        </p>
      </div>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink shrink-0">
        {cta}
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

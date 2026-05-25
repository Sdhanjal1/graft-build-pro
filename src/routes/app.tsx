import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import {
  userProfile, stats, formatGBP, getClient, userClients, mockQuotes,
  todaysJobs, formatTime, getQuote,
} from "@/lib/user-data";
import { Mic, ArrowRight, UserPlus, MapPin, FileText, Bell, AlertTriangle, Clock, Send, Sparkles } from "lucide-react";
import { QuottrWordmark } from "@/components/QuottrLogo";
import { RotatingPrompts } from "@/components/RotatingPrompts";
import { useSession } from "@/lib/auth";

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
    return <div className="min-h-screen bg-paper" />;
  }

  const s = stats();
  const today = todaysJobs();
  const firstName = userProfile.full_name.split(" ")[0] || "there";
  const greeting = greetingFor();
  const clientCount = userClients.length;

  // Action-queue breakdown
  const pendingQuotes = mockQuotes.filter((q) => q.status === "pending");
  const awaitingQuotes = mockQuotes.filter((q) => q.status === "sent" || q.status === "accepted");
  const overdueQuotes = mockQuotes.filter((q) => q.status === "overdue");

  const pendingTotal = pendingQuotes.reduce((sum, q) => sum + q.total, 0);
  const awaitingTotal = awaitingQuotes.reduce((sum, q) => sum + q.total, 0);
  const overdueTotal = overdueQuotes.reduce((sum, q) => sum + q.total, 0);

  const hasActions = pendingQuotes.length > 0 || awaitingQuotes.length > 0 || overdueQuotes.length > 0;

  return (
    <AppShell>
      <div className="flex flex-col min-h-[calc(100dvh-7rem)]">
      {/* Ink header: greeting + £ outstanding */}

      <header className="bg-ink text-paper rounded-b-3xl px-5 pt-5 pb-6">
        <div className="flex items-center justify-between">
          <QuottrWordmark className="text-3xl" />
          <Link
            to="/settings"
            className="text-[10px] uppercase tracking-widest font-semibold text-paper/60 hover:text-lime transition"
          >
            {userProfile.business_name || "Set up"}
          </Link>
        </div>

        <p className="mt-5 text-[10px] uppercase tracking-widest text-paper/60 font-semibold">
          {greeting}, {firstName}
        </p>

        <div className="mt-1">
          <p className="text-[10px] uppercase tracking-widest text-paper/60 font-semibold">
            You are owed
          </p>
          {s.outstanding > 0 ? (
            <Link to="/chaser" className="block mt-1 active:opacity-80 transition">
              <p className={`num text-6xl leading-none text-lime`}>
                {formatGBP(s.outstanding)}
              </p>
            </Link>
          ) : (
            <p className="num text-6xl mt-1 leading-none text-paper">
              {formatGBP(s.outstanding)}
            </p>
          )}
        </div>

        {/* Stat pills */}
        {hasActions && (
          <div className="mt-4 flex gap-2 flex-wrap">
            {pendingQuotes.length > 0 && (
              <StatPill icon={FileText} count={pendingQuotes.length} label="to send" tone="pending" to="/quotes" />
            )}
            {awaitingQuotes.length > 0 && (
              <StatPill icon={Clock} count={awaitingQuotes.length} label="awaiting" tone="neutral" to="/chaser" />
            )}
            {overdueQuotes.length > 0 && (
              <StatPill icon={AlertTriangle} count={overdueQuotes.length} label="overdue" tone="overdue" to="/chaser" />
            )}
          </div>
        )}
      </header>

      {/* Action queue cards */}
      {hasActions ? (
        <section className="px-5 mt-3 space-y-2">
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
          {awaitingQuotes.length > 0 && (
            <ActionCard
              to="/chaser"
              icon={Bell}
              tone="neutral"
              title="Awaiting payment"
              count={awaitingQuotes.length}
              amount={awaitingTotal}
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
      ) : (
        <section className="px-5 mt-4">
          <div className="card-surface p-5 text-center">
            <div className="h-12 w-12 rounded-full bg-lime/15 flex items-center justify-center mx-auto">
              <Sparkles className="h-6 w-6 text-ink" />
            </div>
            <p className="mt-3 text-sm font-semibold text-ink">All caught up</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Nothing needs your attention right now. Tap the mic to start a new quote.
            </p>
          </div>
        </section>
      )}

      {/* Today's jobs */}
      {today.length > 0 && (
        <section className="px-5 mt-3">
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
      <section className="px-5 mt-4 flex-1 flex">
        <Link
          to="/quotes/new"
          search={{ voice: 1 }}
          onClick={() => buzz(12)}
          className="flex flex-col w-full rounded-3xl bg-ink text-paper p-5 active:scale-[0.99] transition shadow-[0_12px_32px_-16px_rgba(0,0,0,0.5)] text-center"
        >
          <p className="text-[10px] uppercase tracking-widest text-paper/60 font-semibold">
            Tap to start
          </p>
          <p className="text-2xl font-semibold leading-tight mt-1">New voice quote</p>

          <div className="flex-1 flex items-center justify-center my-2">
            <span className="relative h-32 w-32 rounded-full bg-lime flex items-center justify-center shadow-[0_20px_48px_-14px_rgba(200,224,74,0.8)]">
              <span className="absolute inset-0 rounded-full bg-lime/40 animate-ping" />
              <Mic className="relative h-16 w-16 text-ink" strokeWidth={2.5} />
            </span>
          </div>

          <div className="pt-2 border-t border-paper/10">
            <p className="text-[10px] uppercase tracking-widest text-paper/40 font-semibold">
              Try saying
            </p>
            <RotatingPrompts className="mt-1 text-sm text-paper/85 leading-snug" />
          </div>
        </Link>
      </section>


      {/* Quick shortcuts — pinned just above bottom nav */}
      <section className="px-5 mt-2 mb-2">
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/clients"
            className="card-surface flex items-center gap-2.5 px-3 py-2.5 active:scale-[0.99] transition"
          >
            <span className="h-9 w-9 rounded-full bg-lime/15 flex items-center justify-center shrink-0">
              <UserPlus className="h-4 w-4 text-ink" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-ink leading-tight truncate">Clients</span>
              {clientCount > 0 && (
                <span className="block text-[10px] text-muted-foreground mt-0.5">
                  {clientCount} saved
                </span>
              )}
            </span>
          </Link>
          <Link
            to="/capture/new"
            className="card-surface flex items-center gap-2.5 px-3 py-2.5 active:scale-[0.99] transition"
          >
            <span className="h-9 w-9 rounded-full bg-lime/15 flex items-center justify-center shrink-0">
              <MapPin className="h-4 w-4 text-ink" />
            </span>
            <span className="text-sm font-semibold text-ink leading-tight truncate">On-site</span>
          </Link>
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
  tone: "pending" | "neutral" | "overdue";
  to: string;
}) {
  const toneCls =
    tone === "pending"
      ? "bg-status-pending/20 text-status-pending"
      : tone === "overdue"
      ? "bg-status-overdue/20 text-status-overdue"
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
  tone: "pending" | "neutral" | "overdue";
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
      : "border-l-4 border-lime";

  const iconBg =
    tone === "pending"
      ? "bg-status-pending/15"
      : tone === "overdue"
      ? "bg-status-overdue/15"
      : "bg-lime/15";

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
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-[11px] text-muted-foreground">
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

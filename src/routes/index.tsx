import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import {
  mockClients, mockQuotes, mockProfile, mockTransactions, stats, formatGBP, getClient,
  todaysJobs, annualRemindersDue, formatTime, getQuote,
} from "@/lib/mock-data";
import { listActiveCaptures, captureTitle, deleteCapture, type SiteCapture } from "@/lib/site-captures";
import { AlertTriangle, ArrowRight, BarChart3, Mic, CreditCard, Landmark, Banknote, Search, Sparkles, BellRing, MapPin, Clock } from "lucide-react";
import { QuottrWordmark } from "@/components/QuottrLogo";
import { SwipeRow } from "@/components/SwipeRow";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Quottr — Home" },
      { name: "description", content: "Your quotes, clients and overdue invoices at a glance." },
    ],
  }),
});

function HomePage() {
  const s = stats();
  const recentQuotes = mockQuotes.slice(0, 3);
  const recentClients = mockClients.slice(0, 3);
  const today = todaysJobs();
  const reminders = annualRemindersDue(30);
  const [activeCaptures, setActiveCaptures] = useState<SiteCapture[]>([]);

  useEffect(() => {
    let cancelled = false;
    listActiveCaptures()
      .then((list) => { if (!cancelled) setActiveCaptures(list); })
      .catch((e) => console.error("captures", e));
    return () => { cancelled = true; };
  }, []);

  return (
    <AppShell>
      <header className="bg-ink text-paper rounded-b-3xl px-5 pt-6 pb-6">
        <div className="flex items-center justify-between mb-5">
          <QuottrWordmark className="text-3xl" />
          <Link
            to="/search"
            aria-label="Search"
            className="h-10 w-10 rounded-full bg-paper/10 border border-paper/15 flex items-center justify-center"
          >
            <Search className="h-4 w-4 text-paper" />
          </Link>
        </div>
        <p className="text-[10px] uppercase tracking-widest text-paper/60 font-semibold">
          Good morning
        </p>
        <h1 className="text-4xl leading-none mt-1 text-paper">{mockProfile.full_name.split(" ")[0]}</h1>
        <p className="mt-2 text-sm text-paper/70">{mockProfile.business_name}</p>
      </header>
      <div className="h-4" />

      {/* Hero stat */}
      <section className="px-5">
        <div className="rounded-2xl bg-ink text-paper p-5 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-lime/20 blur-2xl" />
          <p className="text-xs uppercase tracking-widest text-paper/60 font-semibold">Total quoted this month</p>
          <p className="num text-5xl mt-1 text-lime">{formatGBP(s.totalQuoted)}</p>
          <div className="mt-4 flex gap-2">
            <Link
              to="/quotes/new"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-lime text-ink rounded-full py-3 text-sm font-semibold"
            >
              <Mic className="h-4 w-4" />
              New quote
            </Link>
            <Link
              to="/quotes"
              className="px-4 inline-flex items-center justify-center bg-paper/10 text-paper rounded-full text-sm font-semibold"
            >
              View all
            </Link>
          </div>
          <Link
            to="/capture/new"
            className="mt-2 w-full inline-flex items-center justify-center gap-2 bg-paper/10 border border-lime/40 text-lime rounded-full py-3 text-sm font-semibold active:scale-[0.99] transition"
          >
            <MapPin className="h-4 w-4" />
            Start site capture
          </Link>
        </div>
      </section>

      {/* Active site captures */}
      {activeCaptures.length > 0 && (
        <section className="px-5 mt-4">
          <div className="rounded-2xl bg-ink text-paper p-4 border border-lime/30">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-lime" />
              <p className="text-[10px] uppercase tracking-widest font-semibold text-paper/60">
                {activeCaptures.length} active site capture{activeCaptures.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="space-y-1.5">
              {activeCaptures.slice(0, 3).map((c) => (
                <SwipeRow
                  key={c.id}
                  onDelete={async () => {
                    try {
                      await deleteCapture(c.id);
                      setActiveCaptures((prev) => prev.filter((x) => x.id !== c.id));
                      toast.success("Site capture deleted");
                    } catch (e) {
                      toast.error("Couldn't delete site capture");
                      throw e;
                    }
                  }}
                  className="rounded-xl"
                >
                  <Link
                    to="/capture/$captureId"
                    params={{ captureId: c.id }}
                    className="flex items-center gap-3 rounded-xl bg-paper/5 px-3 py-2.5 active:scale-[0.99] transition"
                  >
                    <Clock className="h-4 w-4 text-lime shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-paper">{captureTitle(c)}</p>
                      <p className="text-[11px] text-paper/50 truncate">
                        Updated {new Date(c.updated_at).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-paper/40" />
                  </Link>
                </SwipeRow>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Stats row */}
      <section className="px-5 mt-4 grid grid-cols-3 gap-3">
        <StatTile label="Clients" value={String(s.clientCount)} />
        <StatTile label="Quotes" value={String(s.quoteCount)} />
        <StatTile label="Avg" value={formatGBP(s.avgQuote)} small />
      </section>

      {/* Overdue alert */}
      {s.overdueCount > 0 && (
        <section className="px-5 mt-4">
          <Link
            to="/chaser"
            className="flex items-center gap-3 rounded-2xl bg-status-overdue/10 border border-status-overdue/30 p-4"
          >
            <div className="h-10 w-10 rounded-full bg-status-overdue/20 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-status-overdue" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">
                {s.overdueCount} overdue {s.overdueCount === 1 ? "invoice" : "invoices"}
              </p>
              <p className="num text-lg text-status-overdue leading-none mt-0.5">
                {formatGBP(s.overdueAmount)}
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-status-overdue" />
          </Link>
        </section>
      )}

      {/* Today */}
      {today.length > 0 && (
        <section className="px-5 mt-4">
          <div className="card-surface p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-lime" />
              <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Today</p>
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
                    <div className="num text-lg text-ink leading-none w-14 shrink-0">{formatTime(j.starts_at)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{q.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{c?.name} · {c?.address}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Upcoming annual reminders */}
      {reminders.length > 0 && (
        <section className="px-5 mt-4">
          <div className="rounded-2xl bg-lime/15 border border-lime/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <BellRing className="h-4 w-4 text-ink" />
              <p className="text-[10px] uppercase tracking-widest font-semibold text-ink">Upcoming reminders</p>
            </div>
            <div className="space-y-2">
              {reminders.slice(0, 3).map(({ job, quote, client, due }) => {
                const days = Math.max(0, Math.ceil((due - Date.now()) / 86400000));
                return (
                  <Link
                    key={job.id}
                    to="/quotes/$quoteId"
                    params={{ quoteId: quote.id }}
                    className="flex items-center gap-3 active:scale-[0.99] transition"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-ink">{client?.name}</p>
                      <p className="text-xs text-ink/70 truncate">{quote.title}</p>
                    </div>
                    <span className="num text-xs font-bold text-ink bg-paper/60 rounded-full px-2.5 py-1">
                      {days}d
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Recent quotes */}
      <section className="mt-6">
        <SectionHead title="Recent quotes" href="/quotes" />
        <div className="px-5 space-y-2.5">
          {recentQuotes.map((q) => {
            const c = getClient(q.client_id);
            return (
              <Link
                to="/quotes/$quoteId"
                params={{ quoteId: q.id }}
                key={q.id}
                className="card-surface p-4 flex items-center gap-3 active:scale-[0.99] transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{q.ref}</p>
                    <StatusBadge status={q.status} />
                  </div>
                  <p className="font-semibold text-sm mt-1 truncate">{q.title}</p>
                  {c && c.name && c.name.toLowerCase() !== "new client" ? (
                    <p className="text-xs font-bold text-ink truncate">{c.name}</p>
                  ) : (
                    <p className="text-xs font-semibold text-status-pending truncate">Tap to assign client</p>
                  )}
                </div>
                <p className="num text-2xl text-ink leading-none">{formatGBP(q.total)}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent clients */}
      <section className="mt-6">
        <SectionHead title="Recent clients" href="/clients" />
        <div className="px-5 space-y-2.5">
          {recentClients.map((c) => (
            <Link
              to="/clients/$clientId"
              params={{ clientId: c.id }}
              key={c.id}
              className="card-surface p-4 flex items-center gap-3"
            >
              <div className="h-11 w-11 rounded-full bg-lime/30 flex items-center justify-center text-ink font-bold">
                {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">{c.address}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </section>

      {/* Payments */}
      <section className="px-5 mt-6">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-xl">Payments</h2>
          <Link to="/settings" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Settings
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-lime text-ink p-4">
            <p className="text-[10px] uppercase tracking-widest font-semibold opacity-70">Collected this month</p>
            <p className="num text-2xl mt-1 leading-none">{formatGBP(s.collectedThisMonth)}</p>
          </div>
          <div className="rounded-2xl bg-ink text-paper p-4">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-paper/60">Outstanding</p>
            <p className="num text-2xl mt-1 leading-none text-lime">{formatGBP(s.outstanding)}</p>
          </div>
        </div>

        {s.collectedThisMonth === 0 && s.outstanding > 0 && s.outstanding >= s.totalQuoted && (
          <p className="mt-2 text-[11px] text-muted-foreground leading-snug">
            Payments will appear here once collected via Stripe or recorded manually.
          </p>
        )}

        <div className="card-surface mt-3 divide-y divide-border">
          <div className="px-5 py-3 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Recent transactions</p>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </div>
          {mockTransactions.slice(0, 4).map((t) => {
            const Icon = t.method === "card" ? CreditCard : t.method === "bank" ? Landmark : Banknote;
            return (
              <div key={t.id} className="px-5 py-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{t.client_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {t.quote_ref} · {new Date(t.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <p className="num text-lg text-ink">{formatGBP(t.amount)}</p>
              </div>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}

function StatTile({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="card-surface p-3.5">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
      <p className={`num ${small ? "text-xl" : "text-3xl"} mt-1 leading-none text-ink`}>{value}</p>
    </div>
  );
}

function SectionHead({ title, href }: { title: string; href: string }) {
  return (
    <div className="px-5 mb-2.5 flex items-center justify-between">
      <h2 className="text-xl">{title}</h2>
      <Link to={href} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        See all
      </Link>
    </div>
  );
}

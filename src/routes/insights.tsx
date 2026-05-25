import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import {
  mockQuotes,
  mockTransactions,
  formatGBP,
  useDataVersion,
  type PaymentMethod,
} from "@/lib/user-data";
import { getPricingInsights } from "@/lib/pricing-patterns.functions";
import { BarChart3, ChevronLeft, ChevronRight, CreditCard, Landmark, Banknote, Trophy, LineChart, Brain, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/insights")({
  component: InsightsPage,
  head: () => ({
    meta: [
      { title: "Insights, Quottr" },
      { name: "description", content: "Track quoted, collected and outstanding revenue month by month." },
    ],
  }),
});

function InsightsPage() {
  useDataVersion();
  // offset 0 = current month, -1 = previous, +1 = next
  const [offset, setOffset] = useState(0);

  const monthDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    return d;
  }, [offset]);

  const monthLabel = monthDate
    .toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    .toUpperCase();
  const isCurrent = offset === 0;

  const inMonth = (iso: string) => {
    const d = new Date(iso);
    return d.getMonth() === monthDate.getMonth() && d.getFullYear() === monthDate.getFullYear();
  };

  const monthQuotes = useMemo(
    () => mockQuotes.filter((q) => inMonth(q.created_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offset],
  );
  const monthTx = useMemo(
    () => mockTransactions.filter((t) => inMonth(t.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offset],
  );

  const totalQuoted = monthQuotes.reduce((s, q) => s + q.total, 0);
  const collected = monthTx.reduce((s, t) => s + t.amount, 0);
  const outstanding = monthQuotes
    .filter((q) => q.status === "accepted" || q.status === "overdue" || q.status === "pending")
    .reduce((s, q) => s + q.total, 0);

  const byMethod = (m: PaymentMethod) =>
    monthTx.filter((t) => t.method === m).reduce((s, t) => s + t.amount, 0);
  const paidByCard = byMethod("card");
  const paidByBank = byMethod("bank");
  const paidByCash = byMethod("cash");

  const topJobs = useMemo(
    () => [...monthQuotes].sort((a, b) => b.total - a.total).slice(0, 5),
    [monthQuotes],
  );
  const bestJob = topJobs[0];
  const topMax = bestJob?.total ?? 1;

  return (
    <AppShell>
      {/* Header, dark ink */}
      <header className="bg-ink text-paper rounded-b-3xl px-5 pt-8 pb-6">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-lime" />
          <p className="text-[10px] uppercase tracking-widest text-paper/60 font-semibold">Insights</p>
        </div>
        {/* Month toggle */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setOffset((o) => o - 1)}
            aria-label="Previous month"
            className="h-10 w-10 rounded-full bg-paper/10 flex items-center justify-center active:scale-95 transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h1 className="text-3xl leading-none text-paper">{monthLabel}</h1>
          <button
            type="button"
            onClick={() => setOffset((o) => o + 1)}
            disabled={offset >= 0}
            aria-label="Next month"
            className="h-10 w-10 rounded-full bg-paper/10 flex items-center justify-center disabled:opacity-30 active:scale-95 transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {!isCurrent && (
          <button
            type="button"
            onClick={() => setOffset(0)}
            className="mt-3 mx-auto block text-[10px] uppercase tracking-widest font-bold text-lime"
          >
            Jump to this month
          </button>
        )}
      </header>

      {totalQuoted === 0 && collected === 0 && monthTx.length === 0 ? (
        <section className="px-5 mt-6">
          <EmptyState
            icon={LineChart}
            title="No data yet"
            body="Send a few quotes and the numbers will start telling a story."
            cta={{ label: "New quote", to: "/quotes/new" }}
          />
        </section>
      ) : (
      <>
      {/* Top summary card */}
      <section className="px-5 -mt-4">
        <div className="rounded-2xl bg-ink text-paper p-5 relative overflow-hidden shadow-elegant">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-lime/20 blur-2xl" />
          <p className="text-[10px] uppercase tracking-widest text-paper/60 font-semibold">
            Total quoted this month
          </p>
          <p className="num text-5xl mt-1 text-lime leading-none">{formatGBP(totalQuoted)}</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <SummaryStat label="Collected" value={formatGBP(collected)} tone="green" />
            <SummaryStat label="Outstanding" value={formatGBP(outstanding)} tone="amber" />
          </div>
        </div>
      </section>

      {/* Received by method */}
      <section className="px-5 mt-5">
        <h2 className="text-xl mb-2.5">Received by method</h2>
        <div className="card-surface p-5 space-y-3">
          <MethodBar icon={CreditCard} label="Card" value={paidByCard} total={collected} />
          <MethodBar icon={Landmark} label="Bank transfer" value={paidByBank} total={collected} />
          <MethodBar icon={Banknote} label="Cash" value={paidByCash} total={collected} />
          {collected === 0 && (
            <p className="text-[11px] text-muted-foreground pt-1">
              Payments will appear here once collected via Stripe or recorded manually.
            </p>
          )}
        </div>
      </section>

      {/* Best performing job */}
      {bestJob && (
        <section className="px-5 mt-5">
          <div className="rounded-2xl p-4 flex items-center gap-3 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, oklch(0.82 0.14 85), oklch(0.72 0.16 65))",
              color: "oklch(0.18 0.02 80)",
            }}
          >
            <div className="h-11 w-11 rounded-full bg-ink text-lime flex items-center justify-center shrink-0">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-widest font-bold opacity-70">
                Best performing job
              </p>
              <p className="text-sm font-semibold truncate">{bestJob.title}</p>
            </div>
            <p className="num text-2xl shrink-0">{formatGBP(bestJob.total)}</p>
          </div>
        </section>
      )}

      {/* Top 5 by value */}
      <section className="px-5 mt-5 mb-6">
        <h2 className="text-xl mb-2.5">Top 5 jobs by value</h2>
        <div className="card-surface p-5 space-y-3">
          {topJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No quotes this month yet.</p>
          ) : (
            topJobs.map((q) => (
              <div key={q.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="truncate pr-2 font-medium">{q.title}</span>
                  <span className="num font-semibold shrink-0">{formatGBP(q.total)}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ink rounded-full"
                    style={{ width: `${(q.total / topMax) * 100}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Recent transactions */}
      <section className="px-5 mb-8">
        <h2 className="text-xl mb-2.5">Recent transactions</h2>
        <div className="card-surface divide-y divide-border">
          {monthTx.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground text-center">
              No payments recorded this month.
            </p>
          ) : (
            monthTx.slice(0, 8).map((t) => {
              const Icon = t.method === "card" ? CreditCard : t.method === "bank" ? Landmark : Banknote;
              return (
                <div key={t.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{t.client_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {t.quote_ref} ·{" "}
                      {new Date(t.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <p className="num text-lg text-ink">{formatGBP(t.amount)}</p>
                </div>
              );
            })
          )}
        </div>
      </section>

      <PricingPatternsSection />
      </>
      )}
    </AppShell>
  );
}

function PricingPatternsSection() {
  const fetchInsights = useServerFn(getPricingInsights);
  const { data } = useQuery({
    queryKey: ["pricing-insights"],
    queryFn: () => fetchInsights(),
    staleTime: 60_000,
  });

  if (!data || data.total === 0) {
    return (
      <section className="px-5 mb-8">
        <div className="flex items-center gap-2 mb-2.5">
          <Brain className="h-4 w-4 text-lime" />
          <h2 className="text-xl">Your pricing patterns</h2>
        </div>
        <div className="card-surface p-5">
          <p className="text-sm text-muted-foreground">
            Quottr will start learning your typical prices after you save your first few quotes.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="px-5 mb-8">
      <div className="flex items-center gap-2 mb-2.5">
        <Brain className="h-4 w-4 text-lime" />
        <h2 className="text-xl">Your pricing patterns</h2>
      </div>
      <div className="card-surface p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-ink text-paper p-3">
            <p className="text-[10px] uppercase tracking-widest font-bold text-paper/60">In memory</p>
            <p className="num text-2xl mt-1 leading-none text-lime">{data.total}</p>
            <p className="text-[11px] text-paper/60 mt-1">items Quottr remembers</p>
          </div>
          <div className="rounded-2xl bg-lime/15 p-3">
            <p className="text-[10px] uppercase tracking-widest font-bold text-ink/70">Avg labour rate</p>
            <p className="num text-2xl mt-1 leading-none text-ink">
              {data.averageLabourRate > 0 ? formatGBP(data.averageLabourRate) : "—"}
            </p>
            <p className="text-[11px] text-ink/60 mt-1">
              {data.labourSampleCount > 0 ? `from ${data.labourSampleCount} items` : "no labour items yet"}
            </p>
          </div>
        </div>
        {data.top.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Most quoted items
            </p>
            <ul className="space-y-2">
              {data.top.map((p, i) => {
                const TrendIcon = p.trend === "up" ? TrendingUp : p.trend === "down" ? TrendingDown : Minus;
                const trendCls =
                  p.trend === "up"
                    ? "text-status-accepted"
                    : p.trend === "down"
                    ? "text-status-overdue"
                    : "text-muted-foreground";
                return (
                  <li key={i} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate capitalize">{p.description}</p>
                      <p className="text-[11px] text-muted-foreground">quoted {p.price_count}×</p>
                    </div>
                    <TrendIcon className={`h-3.5 w-3.5 ${trendCls}`} />
                    <p className="num text-sm font-semibold shrink-0">{formatGBP(p.typical_price)}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground pt-1 border-t border-border">
          Quottr uses these to pre-fill prices on new quotes so they match how you actually charge.
        </p>
      </div>
    </section>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" }) {
  const cls =
    tone === "green"
      ? "bg-status-accepted/15 text-status-accepted"
      : "bg-status-pending/15 text-status-pending";
  return (
    <div className={`rounded-2xl p-3 ${cls}`}>
      <p className="text-[10px] uppercase tracking-widest font-bold opacity-80">{label}</p>
      <p className="num text-xl mt-1 leading-none">{value}</p>
    </div>
  );
}

function MethodBar({
  icon: Icon,
  label,
  value,
  total,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="inline-flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          <span className="font-medium">{label}</span>
        </span>
        <span className="num font-semibold">{formatGBP(value)}</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-lime rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

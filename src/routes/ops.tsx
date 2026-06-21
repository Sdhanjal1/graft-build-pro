import { createFileRoute, redirect, isRedirect } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getOpsDashboard,
  getIsAdmin,
  verifyConnectClientId,
  type OpsDashboard,
  type ConnectClientIdCheck,
} from "@/lib/ops.functions";

const opsQueryOptions = (fn: () => Promise<OpsDashboard>) =>
  queryOptions({
    queryKey: ["ops-dashboard"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/ops")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { isAdmin } = await getIsAdmin();
      if (!isAdmin) throw redirect({ to: "/app" });
    } catch (e) {
      if (isRedirect(e)) throw e;
      throw redirect({ to: "/auth" });
    }
  },
  component: OpsPage,
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[var(--paper)] text-ink">
      <div className="card-surface p-6 max-w-md">
        <h1 className="font-display text-2xl mb-2">Ops error</h1>
        <p className="text-sm text-ink/70">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-[var(--paper)] text-ink">
      Not found
    </div>
  ),
});

function gbp(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function gbp2(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

function pct(v: number | null | undefined) {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

function fmtAgo(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs uppercase tracking-[0.15em] text-ink/75 font-medium">
        {title}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {children}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  hero,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  hero?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`card-surface p-4 ${hero ? "col-span-2 md:col-span-2 lg:col-span-2" : ""} ${
        muted ? "opacity-80" : ""
      }`}
    >
      <div className="text-[11px] uppercase tracking-wider text-ink/75">{label}</div>
      <div
        className={`font-display leading-none mt-2 ${hero ? "text-6xl" : "text-3xl"}`}
      >
        {value}
      </div>
      {sub && <div className="mt-2 text-xs text-ink/80">{sub}</div>}
    </div>
  );
}

function ConnectClientIdPanel() {
  const verify = useServerFn(verifyConnectClientId);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ConnectClientIdCheck | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await verify();
      setResult(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const tone =
    result?.mode === "live"
      ? "bg-lime/30 text-ink"
      : result?.mode === "mismatch"
      ? "bg-red-100 text-red-800"
      : "bg-ink/5 text-ink/70";

  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div>
          <h2 className="font-display text-2xl">Stripe Connect client id</h2>
          <p className="text-xs text-ink/75 mt-0.5">
            Probes Stripe to confirm STRIPE_CONNECT_CLIENT_ID matches the live platform key.
          </p>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="text-xs px-3 py-1.5 rounded-full border border-ink/20 hover:bg-ink/5 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Verify"}
        </button>
      </div>
      {err && <p className="text-sm text-red-700">{err}</p>}
      {result && (
        <div className={`text-sm rounded-md px-3 py-2 ${tone}`}>
          <div className="font-medium">{result.message}</div>
          <div className="text-[11px] mt-1 opacity-70">
            HTTP {result.httpStatus}
            {result.stripeErrorType ? ` · ${result.stripeErrorType}` : ""} · client id{" "}
            {result.clientIdPresent ? "set" : "MISSING"} · live key{" "}
            {result.liveKeyPresent ? "set" : "MISSING"}
          </div>
        </div>
      )}
    </div>
  );
}

function OpsPage() {
  const fn = useServerFn(getOpsDashboard);
  const { data } = useSuspenseQuery(opsQueryOptions(() => fn()));

  return (
    <div className="min-h-screen bg-[var(--paper)] text-ink">
      <header className="border-b border-ink/10">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl tracking-wide">Quottr · Ops</h1>
            <p className="text-xs text-ink/75 mt-1">
              Admin-only · live data · refreshed {fmtAgo(data.generatedAt)}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-xs px-3 py-1.5 rounded-full border border-ink/20 hover:bg-ink/5"
          >
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-10">
        {/* REVENUE */}
        <Section title="Revenue — money Quottr keeps">
          <Stat
            label="MRR"
            value={gbp(data.revenue.mrrPence)}
            sub={`${data.revenue.activeCount} active · ${data.revenue.trialingCount} trialing`}
            hero
          />
          <Stat
            label="Total Quottr revenue"
            value={gbp(data.revenue.totalRevenuePence)}
            sub="MRR + platform fees"
          />
          <Stat
            label="Platform fees earned"
            value={gbp(data.revenue.platformFeesPence)}
            sub={data.revenue.feesPartlyEstimated ? "(partly est.)" : "captured from Stripe"}
          />
          <Stat
            label="Trial → paid"
            value={pct(data.revenue.trialToPaidPct)}
            sub={`${data.revenue.trialConverted}/${data.revenue.trialEndedTotal} trials ended`}
          />
          <Stat label="Active" value={data.revenue.activeCount} />
          <Stat label="Trialing" value={data.revenue.trialingCount} />
          <Stat label="Past due" value={data.revenue.pastDueCount} />
          <Stat label="Cancelled" value={data.revenue.canceledCount} />
        </Section>

        {/* GMV */}
        <Section title="Payment volume — money through the platform (NOT Quottr revenue)">
          <Stat
            label="Total GMV processed"
            value={gbp(data.gmv.totalPence)}
            sub="Lifetime invoices paid via Quottr"
            hero
          />
          <Stat label="GMV · last 7d" value={gbp(data.gmv.last7dPence)} />
          <Stat label="GMV · last 30d" value={gbp(data.gmv.last30dPence)} />
          <Stat
            label="Traders taking payments"
            value={data.gmv.distinctTraders}
            sub="distinct traders with ≥1 paid invoice"
          />
          <Stat
            label="Avg payment"
            value={gbp2(data.gmv.avgPaymentPence)}
            sub={`${data.gmv.paidPaymentsCount} paid invoices`}
          />
          <Stat
            label="Payments / active trader"
            value={data.gmv.paymentsPerActiveTrader}
          />
        </Section>

        {/* ACTIVATION */}
        <Section title="Activation">
          <Stat
            label="Signups"
            value={data.activation.signupsTotal}
            sub={`+${data.activation.signupsLast7d} in 7d · +${data.activation.signupsLast30d} in 30d`}
            hero
          />
          <Stat
            label="Activation rate"
            value={pct(data.activation.activationRatePct)}
            sub={`${data.activation.activatedCount}/${data.activation.signupsTotal} created ≥1 quote`}
          />
          <Stat
            label="First quote < 24h"
            value={pct(data.activation.firstQuoteWithin24hPct)}
            sub={`${data.activation.firstQuoteWithin24hCount} users`}
          />
          <Stat label="Draft quotes" value={data.activation.quoteFunnel.draft} />
          <Stat label="Sent" value={data.activation.quoteFunnel.sent} />
          <Stat label="Accepted" value={data.activation.quoteFunnel.accepted} />
          <Stat label="Paid" value={data.activation.quoteFunnel.paid} />
        </Section>

        {/* HEALTH */}
        <Section title="Health">
          <Stat label="Past-due subs" value={data.health.pastDueSubs} />
          <Stat label="Failed payments" value={data.health.failedPayments} />
          <Stat
            label="Stuck Connect onboarding"
            value={data.health.stuckConnect}
            sub="connected but charges_enabled=false"
          />
          <Stat
            label="Cold leads"
            value={data.health.coldLeads}
            sub="unactioned quote requests"
          />
        </Section>

        {/* PANELS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Errors */}
          <div className="card-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-2xl">Recent errors</h2>
              <span className="text-xs text-ink/75">last 20</span>
            </div>
            {data.recentErrors.length === 0 ? (
              <p className="text-sm text-ink/80 py-6 text-center">No errors logged 🎉</p>
            ) : (
              <ul className="divide-y divide-ink/5 -mx-1">
                {data.recentErrors.map((e) => (
                  <li key={e.id} className="py-2.5 px-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-red-700/80">
                        {e.context}
                      </span>
                      <span className="text-[11px] text-ink/70 shrink-0">
                        {fmtAgo(e.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-ink/80 mt-0.5 break-words">
                      {e.message}
                    </p>
                    {e.userLabel && (
                      <p className="text-[11px] text-ink/70 mt-0.5">{e.userLabel}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Signups feed */}
          <div className="card-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-2xl">Recent signups</h2>
              <span className="text-xs text-ink/75">last 20</span>
            </div>
            {data.recentSignups.length === 0 ? (
              <p className="text-sm text-ink/80 py-6 text-center">No signups yet.</p>
            ) : (
              <ul className="divide-y divide-ink/5 -mx-1">
                {data.recentSignups.map((s) => (
                  <li key={s.id} className="py-2.5 px-1 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {s.businessName || s.email || "(no name)"}
                      </div>
                      <div className="text-[11px] text-ink/75 truncate">
                        {s.trade || "no trade set"} · {fmtAgo(s.createdAt)}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${
                        s.hasSentQuote
                          ? "bg-lime/40 text-ink"
                          : "bg-ink/5 text-ink/75"
                      }`}
                    >
                      {s.hasSentQuote ? "Sent ✓" : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <ConnectClientIdPanel />


        <footer className="text-center text-[11px] text-ink/70 pt-6 pb-12">
          Read-only · all financials across all users · do not share
        </footer>
      </main>
    </div>
  );
}

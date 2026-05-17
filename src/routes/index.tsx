import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { mockClients, mockQuotes, mockProfile, mockTransactions, stats, formatGBP, getClient } from "@/lib/mock-data";
import { AlertTriangle, ArrowRight, BarChart3, Mic, CreditCard, Landmark, Banknote } from "lucide-react";

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

  return (
    <AppShell>
      <header className="px-5 pt-8 pb-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
          Good morning
        </p>
        <h1 className="text-4xl leading-none mt-1">{mockProfile.full_name.split(" ")[0]}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{mockProfile.business_name}</p>
      </header>

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
        </div>
      </section>

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
                  <p className="text-xs text-muted-foreground truncate">{c?.name}</p>
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

      {/* Profit teaser */}
      <section className="px-5 mt-6">
        <Link to="/quotes" className="card-surface p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-ink flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-lime" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Profit tracker</p>
            <p className="text-xs text-muted-foreground">Quote breakdown & top jobs</p>
          </div>
          <ArrowRight className="h-5 w-5" />
        </Link>
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

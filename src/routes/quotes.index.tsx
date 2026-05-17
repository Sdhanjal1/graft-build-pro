import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { mockQuotes, getClient, formatGBP, type QuoteStatus } from "@/lib/mock-data";
import { Search } from "lucide-react";

export const Route = createFileRoute("/quotes/")({
  component: QuotesPage,
});

const FILTERS: ("all" | QuoteStatus)[] = ["all", "pending", "accepted", "paid", "overdue"];

function QuotesPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [q, setQ] = useState("");

  const filtered = mockQuotes.filter((x) => {
    if (filter !== "all" && x.status !== filter) return false;
    if (q && !`${x.title} ${x.ref}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <AppShell>
      <header className="px-5 pt-8 pb-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">All work</p>
        <h1 className="text-4xl leading-none mt-1">Quotes</h1>
      </header>

      <div className="px-5">
        <div className="card-surface flex items-center gap-2 px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search quotes"
            className="bg-transparent flex-1 outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-5 mt-4 flex gap-2 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition ${
              filter === f ? "bg-ink text-paper" : "bg-card text-muted-foreground border border-border"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="px-5 mt-4 space-y-2.5">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">No quotes match</p>
        )}
        {filtered.map((quote) => {
          const c = getClient(quote.client_id);
          return (
            <Link
              to="/quotes/$quoteId"
              params={{ quoteId: quote.id }}
              key={quote.id}
              className="card-surface p-4 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{quote.ref}</p>
                  <StatusBadge status={quote.status} />
                </div>
                <p className="font-semibold text-sm mt-1 truncate">{quote.title}</p>
                <p className="text-xs text-muted-foreground truncate">{c?.name}</p>
              </div>
              <p className="num text-2xl text-ink">{formatGBP(quote.total)}</p>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}

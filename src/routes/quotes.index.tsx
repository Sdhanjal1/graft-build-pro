import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";

import { SwipeRow } from "@/components/SwipeRow";
import { mockQuotes, getClient, formatGBP, deleteQuote, useDataVersion, buildChaserMessage, waLink, type QuoteStatus } from "@/lib/user-data";
import { Search, FileText, Inbox } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

const STATUS_DOT: Record<QuoteStatus, string> = {
  pending: "bg-status-pending",
  sent: "bg-status-sent",
  accepted: "bg-status-accepted",
  declined: "bg-status-overdue",
  paid: "bg-status-paid",
  overdue: "bg-status-overdue",
};

const STATUS_LABEL: Record<QuoteStatus, string> = {
  pending: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  paid: "Paid",
  overdue: "Overdue",
};

const UNPAID: QuoteStatus[] = ["sent", "accepted", "overdue"];

export const Route = createFileRoute("/quotes/")({
  component: QuotesPage,
});

const FILTERS: ("all" | QuoteStatus)[] = ["all", "pending", "sent", "accepted", "declined", "paid", "overdue"];

function QuotesPage() {
  useDataVersion();
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
          mockQuotes.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No quotes yet"
              body="Speak it. Quote it. Send it. Get paid."
              cta={{ label: "New quote", to: "/quotes/new" }}
            />
          ) : (
            <EmptyState
              icon={Inbox}
              title="Nothing here"
              body={q ? `No quotes match "${q}".` : `No ${filter} quotes right now.`}
            />
          )
        )}
        {filtered.map((quote) => {
          const c = getClient(quote.client_id);
          const isUnpaid = UNPAID.includes(quote.status);
          const chaseHandler = isUnpaid && c?.phone
            ? () => {
                const first = c.name?.split(" ")[0] ?? "there";
                const msg = buildChaserMessage(quote, first);
                window.open(waLink(c.phone, msg), "_blank");
                toast.success("Chaser opened in WhatsApp");
              }
            : undefined;
          return (
            <SwipeRow
              key={quote.id}
              onDelete={async () => {
                try {
                  await deleteQuote(quote.id);
                  toast.success("Quote deleted");
                } catch (e) {
                  toast.error("Couldn't delete quote");
                  throw e;
                }
              }}
              onChase={chaseHandler}
              chaseLabel="Chase"
            >
              <Link
                to="/quotes/$quoteId"
                params={{ quoteId: quote.id }}
                className="card-surface p-4 flex items-center gap-4 bg-card"
              >
                <div className="flex-1 min-w-0">
                  <p className="num text-5xl leading-none text-ink">{formatGBP(quote.total)}</p>
                  <p className="font-semibold text-xs mt-2 truncate text-ink">
                    {c && c.name && c.name.toLowerCase() !== "new client"
                      ? c.name
                      : <span className="text-status-pending">Tap to assign client</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{quote.title}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[quote.status]}`}
                    aria-label={STATUS_LABEL[quote.status]}
                  />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {STATUS_LABEL[quote.status]}
                  </span>
                </div>
              </Link>
            </SwipeRow>
          );
        })}
      </div>
    </AppShell>
  );
}

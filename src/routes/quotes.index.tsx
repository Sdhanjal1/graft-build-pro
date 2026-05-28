import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";

import { SwipeRow } from "@/components/SwipeRow";
import { mockQuotes, getClient, formatGBP, deleteQuote, duplicateQuote, setQuoteStatus, useDataVersion, buildChaserMessage, waLink, materialsForQuote, userProfile, type Quote, type QuoteStatus } from "@/lib/user-data";
import { resolveTrade } from "@/lib/trades";
import { Search, FileText, Inbox, ShoppingCart } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { QuotesListSkeleton } from "@/components/Skeletons";
import { useSession } from "@/lib/auth";
import { useLongPress } from "@/hooks/useLongPress";
import { QuoteQuickActionsSheet, type QuoteQuickAction } from "@/components/QuoteQuickActionsSheet";

const STATUS_DOT: Record<QuoteStatus, string> = {
  pending: "bg-status-pending",
  sent: "bg-status-sent",
  accepted: "bg-status-booked",
  declined: "bg-status-overdue",
  completed: "bg-status-completed",
  paid: "bg-status-paid",
  overdue: "bg-status-overdue",
};

const STATUS_LABEL: Record<QuoteStatus, string> = {
  pending: "Draft",
  sent: "Sent",
  accepted: "Booked",
  declined: "Declined",
  completed: "Completed",
  paid: "Paid",
  overdue: "Overdue",
};

// Unpaid for the swipe-row "Chase" action — only chase work that's done or overdue.
const UNPAID: QuoteStatus[] = ["completed", "overdue"];

export const Route = createFileRoute("/quotes/")({
  component: QuotesPage,
});

type FilterKey = "all" | "pending" | "sent" | "booked" | "completed" | "paid" | "overdue";
const FILTERS: FilterKey[] = ["all", "pending", "sent", "booked", "completed", "paid", "overdue"];

// Map UI filter chip → underlying QuoteStatus value(s).
const filterMatches = (filter: FilterKey, status: QuoteStatus) => {
  if (filter === "all") return true;
  if (filter === "booked") return status === "accepted";
  return status === filter;
};

function QuotesPage() {
  useDataVersion();
  const { loading } = useSession();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [q, setQ] = useState("");
  const [actionsFor, setActionsFor] = useState<Quote | null>(null);

  if (loading) return <QuotesListSkeleton />;

  const filtered = mockQuotes.filter((x) => {
    if (!filterMatches(filter, x.status)) return false;
    if (q && !`${x.title} ${x.ref}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <AppShell>
      <PageHeader title="Quotes" subtitle="All work" />

      <div className="px-5 mt-4">
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
      <div className="px-5 mt-5 flex gap-2 overflow-x-auto no-scrollbar">
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

      <div className="px-5 mt-5 space-y-2.5">
        {filtered.length === 0 && (
          mockQuotes.length === 0 ? (() => {
            const trade = resolveTrade(userProfile.trade_type);
            return (
              <EmptyState
                icon={FileText}
                title={`No ${trade.noun.jobPlural} yet`}
                body="Tap the mic on Home to make your first one."
              />
            );
          })() : (
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
              <QuoteCard
                quote={quote}
                clientName={c?.name}
                onOpenQuickActions={() => setActionsFor(quote)}
              />
            </SwipeRow>
          );
        })}
      </div>

      <QuoteQuickActionsSheet
        open={actionsFor !== null}
        onOpenChange={(open) => { if (!open) setActionsFor(null); }}
        quoteRef={actionsFor?.ref ?? ""}
        canMarkSent={actionsFor?.status === "pending"}
        onAction={async (action) => {
          const target = actionsFor;
          if (!target) return;
          try {
            if (action === "duplicate") {
              await duplicateQuote(target.id);
              toast.success("Quote duplicated");
            } else if (action === "mark-sent") {
              await setQuoteStatus(target.id, "sent");
              toast.success("Marked as sent");
            } else if (action === "delete") {
              await deleteQuote(target.id);
              toast.success("Quote deleted");
            }
          } catch {
            toast.error("Couldn't complete action");
          }
        }}
      />
    </AppShell>
  );
}

function QuoteCard({
  quote,
  clientName,
  onOpenQuickActions,
}: {
  quote: Quote;
  clientName: string | undefined;
  onOpenQuickActions: () => void;
}) {
  const { handlers, didLongPress, resetLongPress } = useLongPress(onOpenQuickActions, 500);

  return (
    <Link
      to="/quotes/$quoteId"
      params={{ quoteId: quote.id }}
      className="card-surface py-5 px-4 flex items-center gap-4 bg-card"
      {...handlers}
      onClickCapture={(e) => {
        if (didLongPress()) {
          e.preventDefault();
          e.stopPropagation();
          resetLongPress();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      style={{ WebkitTouchCallout: "none", userSelect: "none" }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[32px] font-bold leading-none text-ink">{formatGBP(quote.total)}</p>
        <p className="text-sm mt-2 truncate text-ink">
          {clientName && clientName.toLowerCase() !== "new client"
            ? clientName
            : <span className="text-status-pending">Tap to assign client</span>}
        </p>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{quote.title}</p>
        {quote.status === "accepted" && (() => {
          const n = materialsForQuote(quote).length;
          return n > 0 ? (
            <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-ink/70">
              <ShoppingCart className="h-3 w-3" />
              {n} material{n === 1 ? "" : "s"}
            </p>
          ) : null;
        })()}
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
  );
}

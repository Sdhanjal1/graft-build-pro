import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";

import { SwipeRow } from "@/components/SwipeRow";
import { mockQuotes, getClient, formatGBP, deleteQuote, duplicateQuote, setQuoteStatus, useDataVersion, buildChaserMessage, waLink, materialsForQuote, userProfile, markOverdueQuotes, type Quote, type QuoteStatus } from "@/lib/user-data";
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
  accepted: "Accepted",
  declined: "Declined",
  completed: "Completed",
  paid: "Paid",
  overdue: "Overdue",
};

type TileKey = "pending" | "accepted" | "awaiting" | "overdue";

const TILE_LABEL: Record<TileKey, string> = {
  pending: "Pending",
  accepted: "Accepted",
  awaiting: "Awaiting payment",
  overdue: "Overdue",
};

// Unpaid for the swipe-row "Chase" action — only chase work that's done or overdue.
const UNPAID: QuoteStatus[] = ["completed", "overdue"];

export const Route = createFileRoute("/quotes/")({
  component: QuotesPage,
});

const tileMatches = (tile: TileKey, q: Quote): boolean => {
  if (tile === "pending") return q.status === "pending" || q.status === "sent";
  if (tile === "accepted") return (q.status === "accepted" || q.status === "completed") && q.invoiced_at == null;
  if (tile === "awaiting") return q.invoiced_at != null && q.status !== "paid" && q.status !== "overdue";
  if (tile === "overdue") return q.status === "overdue";
  return false;
};

const STATUS_PILL: Record<QuoteStatus, string> = {
  pending: "bg-ink/10 text-ink",
  sent: "bg-ink/10 text-ink",
  accepted: "bg-lime/25 text-ink border border-lime",
  declined: "bg-ink/10 text-muted-foreground line-through",
  completed: "bg-ink/10 text-ink",
  paid: "bg-lime text-ink",
  overdue: "bg-status-overdue text-white",

};


function QuotesPage() {
  useDataVersion();
  const { loading } = useSession();
  const [tile, setTile] = useState<TileKey | null>(null);
  const [q, setQ] = useState("");
  const [actionsFor, setActionsFor] = useState<Quote | null>(null);

  useEffect(() => { void markOverdueQuotes(); }, []);

  if (loading) return <QuotesListSkeleton />;

  const tiles: { key: TileKey; total: number; count: number }[] = (["pending", "accepted", "awaiting", "overdue"] as TileKey[]).map((k) => {
    const items = mockQuotes.filter((x) => tileMatches(k, x));
    return { key: k, total: items.reduce((s, x) => s + (x.total || 0), 0), count: items.length };
  });

  const pipelineTotal = tiles.reduce((s, t) => s + t.total, 0);
  const pipelineCount = tiles.reduce((s, t) => s + t.count, 0);
  const overdueTile = tiles.find((t) => t.key === "overdue")!;
  const secondaryTiles = tiles.filter((t) => t.key !== "overdue");

  const filtered = mockQuotes.filter((x) => {
    if (tile && !tileMatches(tile, x)) return false;
    if (q && !`${x.title} ${x.ref}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <AppShell>
      <PageHeader title="Quotes" subtitle="All work" />

      {/* HERO PIPELINE STRIP — confident lime block */}
      <div className="px-5 mt-5">
        <div className="rounded-2xl bg-lime text-ink p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink/70">Pipeline</p>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-ink/70 tabular-nums">
              {pipelineCount} quote{pipelineCount === 1 ? "" : "s"}
            </p>
          </div>
          <p
            className="mt-2 leading-[0.85] tabular-nums text-ink"
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(3.5rem, 14vw, 5rem)" }}
          >
            <CountUpGBP value={pipelineTotal} />
          </p>
        </div>
      </div>

      {/* Overdue dominant tile if present */}
      {overdueTile.count > 0 && (
        <div className="px-5 mt-3">
          <button
            onClick={() => setTile(tile === "overdue" ? null : "overdue")}
            aria-pressed={tile === "overdue"}
            className={`w-full text-left rounded-2xl px-5 py-4 border-2 transition motion-safe:animate-pulse-soft ${
              tile === "overdue" ? "bg-ink text-paper border-ink" : "bg-card text-ink border-status-overdue/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] uppercase tracking-[0.2em] font-bold ${tile === "overdue" ? "text-status-overdue" : "text-status-overdue"}`}>
                Overdue · action needed
              </span>
              <span className={`text-xs font-bold tabular-nums ${tile === "overdue" ? "text-paper" : "text-status-overdue"}`}>
                {overdueTile.count}
              </span>
            </div>
            <p
              className={`mt-1 leading-none tabular-nums ${tile === "overdue" ? "text-lime" : "text-ink"}`}
              style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2.25rem, 9vw, 3rem)" }}
            >
              <CountUpGBP value={overdueTile.total} />
            </p>
          </button>
        </div>
      )}

      {/* Secondary tiles */}
      <div className="px-5 mt-3 grid grid-cols-3 gap-2">
        {secondaryTiles.map((t) => {
          const active = tile === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTile(active ? null : t.key)}
              className={`text-left rounded-2xl px-3 py-3 border transition ${
                active
                  ? "bg-ink text-paper border-ink"
                  : "bg-card text-ink border-border hover:border-ink/30"
              }`}
              aria-pressed={active}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[9px] uppercase tracking-widest font-bold ${active ? "text-paper/70" : "text-muted-foreground"}`}>
                  {TILE_LABEL[t.key]}
                </span>
                <span className={`text-[10px] font-bold tabular-nums ${active ? "text-paper" : "text-ink/60"}`}>
                  {t.count}
                </span>
              </div>
              <span
                className={`mt-1.5 block leading-none tabular-nums ${active ? "text-lime" : "text-ink"}`}
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.5rem" }}
              >
                <CountUpGBP value={t.total} />
              </span>
            </button>
          );
        })}
      </div>


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

      {tile && (
        <div className="px-5 mt-3">
          <button
            onClick={() => setTile(null)}
            className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground hover:text-ink"
          >
            Showing {TILE_LABEL[tile]} · Clear filter
          </button>
        </div>
      )}



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
              body={q ? `No quotes match "${q}".` : tile ? `No ${TILE_LABEL[tile].toLowerCase()} quotes right now.` : `No quotes right now.`}
            />
          )
        )}
        {filtered.map((quote, i) => {
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
            <div
              key={quote.id}
              className="row-rise"
              style={{ animationDelay: `${Math.min(i, 6) * 25}ms` }}
            >
              <SwipeRow
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
            </div>
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

  const isDraft = quote.status === "pending";

  const className = `rounded-2xl py-5 px-4 flex items-center gap-4 transition active:scale-[0.99] ${
    quote.status === "overdue"
      ? "bg-ink text-paper border-l-4 border-status-overdue"
      : quote.status === "paid"
      ? "bg-card border-l-4 border-lime shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_12px_-4px_rgb(0_0_0/0.06)]"
      : isDraft
      ? "bg-lime/10 border-l-4 border-lime shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_12px_-4px_rgb(0_0_0/0.06)]"
      : "card-surface bg-card"
  }`;

  const onClickCapture = (e: React.MouseEvent) => {
    if (didLongPress()) {
      e.preventDefault();
      e.stopPropagation();
      resetLongPress();
    }
  };

  const inner = (
    <>
      <div className="flex-1 min-w-0">
        <p
          className={`leading-none tabular-nums ${quote.status === "overdue" ? "text-lime" : "text-ink"}`}
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2.5rem", letterSpacing: "0.01em" }}
        >
          {formatGBP(quote.total)}
        </p>
        <p className={`text-sm mt-2 truncate font-medium ${quote.status === "overdue" ? "text-paper" : "text-ink"}`}>
          {clientName && clientName.toLowerCase() !== "new client"
            ? clientName
            : <span className="text-status-pending">Tap to assign client</span>}
        </p>
        <p className={`text-[11px] truncate mt-0.5 ${quote.status === "overdue" ? "text-paper/60" : "text-muted-foreground"}`}>{quote.title}</p>
        {isDraft && (
          <p className="text-[10px] uppercase tracking-widest font-bold text-ink/60 mt-1.5">
            Draft · tap to continue
          </p>
        )}
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
      <div className="shrink-0">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold ${STATUS_PILL[quote.status]}`}>
          {STATUS_LABEL[quote.status]}
        </span>
      </div>
    </>
  );

  const sharedProps = {
    className,
    onClickCapture,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    style: { WebkitTouchCallout: "none", userSelect: "none" } as React.CSSProperties,
    ...handlers,
  };

  if (isDraft) {
    return (
      <Link to="/quotes/new" search={{ edit: quote.id }} {...sharedProps}>
        {inner}
      </Link>
    );
  }

  return (
    <Link to="/quotes/$quoteId" params={{ quoteId: quote.id }} {...sharedProps}>
      {inner}
    </Link>
  );
}

function CountUpGBP({ value, className }: { value: number; className?: string }) {
  return <span className={`num-appear inline-block ${className ?? ""}`}>{formatGBP(value)}</span>;
}


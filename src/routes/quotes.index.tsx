import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";

import { SwipeRow } from "@/components/SwipeRow";
import { mockQuotes, getClient, formatGBP, deleteQuote, duplicateQuote, setQuoteStatus, useDataVersion, buildChaserMessage, waLink, materialsForQuote, userProfile, markOverdueQuotes, type Quote, type QuoteStatus } from "@/lib/user-data";
import { STATUS_LABEL, STATUS_CHIP } from "@/lib/status-styles";
import { resolveTrade } from "@/lib/trades";
import { Search, FileText, Inbox, ShoppingCart, X, ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { QuotesListSkeleton } from "@/components/Skeletons";

import { feedback } from "@/lib/feedback";
import { useSession } from "@/lib/auth";
import { useLongPress } from "@/hooks/useLongPress";
import { QuoteQuickActionsSheet } from "@/components/QuoteQuickActionsSheet";

type TileKey = "pending" | "accepted" | "awaiting" | "overdue";

const TILE_DOT: Record<TileKey, string> = {
  pending: "bg-status-pending",
  accepted: "bg-lime",
  awaiting: "bg-status-sent",
  overdue: "bg-status-overdue",
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

// Sectioned editorial rhythm — order = visual priority (urgent → done).
type SectionKey = TileKey | "paid";

const GROUP_LABEL: Record<SectionKey, string> = {
  overdue: "Overdue",
  awaiting: "Awaiting payment",
  accepted: "Booked",
  pending: "Drafts & sent",
  paid: "Paid",
};

const SECTIONS: { key: SectionKey; label: string; match: (q: Quote) => boolean }[] = [
  { key: "overdue", label: GROUP_LABEL.overdue, match: (q) => tileMatches("overdue", q) },
  { key: "awaiting", label: GROUP_LABEL.awaiting, match: (q) => tileMatches("awaiting", q) },
  { key: "accepted", label: GROUP_LABEL.accepted, match: (q) => tileMatches("accepted", q) },
  { key: "pending", label: GROUP_LABEL.pending, match: (q) => tileMatches("pending", q) },
  { key: "paid", label: GROUP_LABEL.paid, match: (q) => q.status === "paid" },
];



function QuotesPage() {
  useDataVersion();
  const { loading } = useSession();
  const [tile, setTile] = useState<TileKey | null>(null);
  const [sectionFilter, setSectionFilter] = useState<SectionKey | null>(null);
  const [q, setQ] = useState("");
  const [actionsFor, setActionsFor] = useState<Quote | null>(null);

  useEffect(() => { void markOverdueQuotes(); }, []);

  if (loading) return <QuotesListSkeleton />;

  const tiles: { key: TileKey; total: number; count: number }[] = (["pending", "accepted", "awaiting", "overdue"] as TileKey[]).map((k) => {
    const items = mockQuotes.filter((x) => tileMatches(k, x));
    return { key: k, total: items.reduce((s, x) => s + (x.total || 0), 0), count: items.length };
  });

  const pipelineTiles = tiles.filter((t) => t.key === "pending" || t.key === "accepted");
  const pipelineTotal = pipelineTiles.reduce((s, t) => s + t.total, 0);
  const pipelineCount = pipelineTiles.reduce((s, t) => s + t.count, 0);
  const overdueTile = tiles.find((t) => t.key === "overdue")!;
  const awaitingTile = tiles.find((t) => t.key === "awaiting")!;
  const pendingTile = tiles.find((t) => t.key === "pending")!;
  const bookedTile = tiles.find((t) => t.key === "accepted")!;
  const secondaryTiles = tiles.filter((t) => t.key === "pending" || t.key === "accepted");
  const toCollectTotal = awaitingTile.total + overdueTile.total;
  const toCollectCount = awaitingTile.count + overdueTile.count;

  const subtitle = (() => {
    const parts: string[] = [];
    if (pendingTile.count) parts.push(`${pendingTile.count} pending`);
    if (bookedTile.count) parts.push(`${bookedTile.count} booked`);
    return parts.length ? parts.join(" · ") : "All clear";
  })();

  const filtered = mockQuotes.filter((x) => {
    if (tile && !tileMatches(tile, x)) return false;
    if (q && !`${x.title} ${x.ref}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const emptyMessage = (() => {
    if (q && tile) return `No ${GROUP_LABEL[tile].toLowerCase()} quotes match "${q}".`;
    if (q) return `No quotes match "${q}".`;
    if (tile) return `No ${GROUP_LABEL[tile].toLowerCase()} quotes right now.`;
    return "No quotes right now.";
  })();

  return (
    <AppShell>
      <PageHeader
        title="Quotes"
        subtitle={subtitle}
        urgent={overdueTile.count > 0}
        action={{ to: "/quotes/new", search: { voice: 1 }, label: "+ New" }}
      />

      {/* HERO PIPELINE STRIP */}
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
          <p className="text-[10px] uppercase tracking-widest font-bold text-ink/55 mt-0.5">
            Active pipeline value
          </p>
          {(awaitingTile.count > 0 || overdueTile.count > 0) && (
            <div className="mt-3 space-y-1">
              {awaitingTile.count > 0 && (
                <p className="text-[11px] font-semibold text-ink/80 tabular-nums inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-sent" />
                  {formatGBP(awaitingTile.total)} awaiting payment
                </p>
              )}
              {overdueTile.count > 0 && (
                <p className="text-[11px] font-semibold text-ink/80 tabular-nums flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-overdue" />
                  {formatGBP(overdueTile.total)} overdue
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Overdue dominant tile */}
      {overdueTile.count > 0 && (
        <div className="px-5 mt-3 row-rise">
          <button
            onClick={() => setTile(tile === "overdue" ? null : "overdue")}
            aria-pressed={tile === "overdue"}
            className={`w-full text-left rounded-2xl px-4 py-3 border-2 transition ${
              tile === "overdue"
                ? "bg-status-overdue/10 border-status-overdue"
                : "bg-card border-status-overdue/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-wide uppercase font-bold text-status-overdue inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-status-overdue" />
                Overdue · action needed
              </span>
              <span className="text-[10px] font-bold tabular-nums bg-status-overdue text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {overdueTile.count}
              </span>
            </div>
            <p
              className="mt-1.5 leading-none tabular-nums text-ink"
              style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.875rem" }}
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
              className={`text-left rounded-2xl px-4 py-3 border transition ${
                active
                  ? "bg-secondary text-ink border-ink"
                  : "bg-card text-ink border-border hover:border-ink/30"
              }`}
              aria-pressed={active}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-[10px] tracking-wide uppercase font-bold text-muted-foreground inline-flex items-start gap-1 min-w-0">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 mt-1 ${TILE_DOT[t.key]}`} />
                  <span className="leading-tight">{GROUP_LABEL[t.key]}</span>
                </span>
                <span className={`text-[10px] font-bold tabular-nums shrink-0 ${active ? "bg-ink text-paper rounded-full px-1.5 min-w-[18px] text-center" : "text-ink/60"}`}>
                  {t.count}
                </span>
              </div>
              <span
                className="mt-1.5 block leading-none tabular-nums text-ink"
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.875rem" }}
              >
                <CountUpGBP value={t.total} />
              </span>
            </button>
          );
        })}
      </div>


      <div className="px-5 mt-4 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 rounded-full bg-card border border-border px-3.5 py-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search quotes"
            className="bg-transparent flex-1 outline-none text-[15px] placeholder:text-muted-foreground min-w-0"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="shrink-0 text-muted-foreground hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {tile && (
          <button
            onClick={() => setTile(null)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-secondary text-ink px-3 py-2 text-[11px] font-bold uppercase tracking-wide"
            aria-label={`Clear ${GROUP_LABEL[tile]} filter`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${TILE_DOT[tile]}`} />
            {GROUP_LABEL[tile]}
            <span aria-hidden className="text-muted-foreground text-sm leading-none">×</span>
          </button>
        )}
      </div>

      {/* Quick section chips — jump straight to a standardized status group. */}
      {(() => {
        const nonEmptySections = SECTIONS.filter((s) => mockQuotes.some(s.match));
        if (nonEmptySections.length < 2) return null;
        return (
      <div className="px-5 mt-3 -mx-1 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 px-1 pb-0.5">
          {SECTIONS.map((s) => {
            const count = mockQuotes.filter(s.match).length;
            if (count === 0) return null;
            const active = sectionFilter === s.key;
            const dot = s.key === "paid" ? "bg-lime" : TILE_DOT[s.key];
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => { setSectionFilter(active ? null : s.key); feedback("tap"); }}
                aria-pressed={active}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide border transition active:scale-95 ${
                  active
                    ? "bg-ink text-paper border-ink"
                    : "bg-card text-ink border-border hover:border-ink/30"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                {s.label}
                <span className={`tabular-nums text-[10px] ${active ? "text-paper/70" : "text-muted-foreground"}`}>
                  {count}
                </span>
              </button>
            );
          })}
          {sectionFilter && (
            <button
              type="button"
              onClick={() => setSectionFilter(null)}
              className="shrink-0 inline-flex items-center rounded-full px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-secondary"
              aria-label="Clear section filter"
            >
              Clear
            </button>
          )}
        </div>
      </div>
        );
      })()}




      <div className="px-5 mt-4 space-y-2.5">

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
            <div>
              <EmptyState
                icon={Inbox}
                title="Nothing here"
                body={emptyMessage}
              />
              {(tile || q) && (
                <div className="flex justify-center mt-3">
                  <button
                    type="button"
                    onClick={() => { setTile(null); setQ(""); }}
                    className="inline-flex items-center text-[11px] font-semibold text-muted-foreground rounded-full px-3 py-1.5 hover:bg-secondary"
                  >
                    Clear filter
                  </button>
                </div>
              )}
            </div>
          )
        )}
        {(() => {
          // Group the filtered list by section so each bucket gets its own
          // editorial heading. Index is continuous so row-rise stagger flows
          // smoothly across section boundaries.
          let renderedIdx = 0;
          return SECTIONS.map((section) => {
            if (sectionFilter && section.key !== sectionFilter) return null;
            const items = filtered.filter(section.match);
            if (items.length === 0) return null;
            return (
              <section key={section.key} className="space-y-2.5">
                <div className="flex items-center justify-between pt-1">
                  <h2 className="font-display uppercase tracking-[0.08em] text-ink text-xs leading-none inline-flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${section.key === "paid" ? "bg-lime" : TILE_DOT[section.key]}`} />
                    {section.label}
                  </h2>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground tabular-nums">
                    {items.length}
                  </span>
                </div>
                {items.map((quote) => {
                  const i = renderedIdx++;
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
                      style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }}
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
              </section>
            );
          });
        })()}

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
  const isOverdue = quote.status === "overdue";
  const isPaid = quote.status === "paid";

  // Active states use a soft lime/paper tint that mirrors the success palette,
  // plus a tiny ring on press so the touch reads like a button, not a link.
  const activeTint = isOverdue
    ? "active:bg-status-overdue/90"
    : isPaid
    ? "active:bg-lime/20"
    : "active:bg-lime/15";

  const className = `rounded-2xl py-4 px-4 flex items-start gap-3 transition-all duration-150 active:scale-[0.985] active:shadow-[0_0_0_3px_color-mix(in_oklab,var(--lime,#c8ff3e)_25%,transparent)] touch-manipulation ${activeTint} ${
    isOverdue
      ? "bg-ink text-paper border-l-4 border-status-overdue"
      : isPaid
      ? "card-surface bg-card border-l-4 border-lime opacity-80"
      : isDraft
      ? "card-surface bg-lime/10 border-l-4 border-lime"
      : "card-surface bg-card"
  }`;

  const onClickCapture = (e: React.MouseEvent) => {
    if (didLongPress()) {
      e.preventDefault();
      e.stopPropagation();
      resetLongPress();
      return;
    }
    // Haptic-like tap (where supported) — keeps the lime accent feeling tactile.
    feedback("tap");
  };



  const hasClient = clientName && clientName.toLowerCase() !== "new client";
  const acceptedMaterials = quote.status === "accepted" ? materialsForQuote(quote).length : 0;

  const inner = (
    <>
      <div className="flex-1 min-w-0">
        {/* Primary: client name */}
        <p className={`text-sm font-semibold truncate ${isOverdue ? "text-paper" : "text-ink"}`}>
          {hasClient
            ? clientName
            : <span className="text-status-pending">Tap to assign client</span>}
        </p>
        {/* Secondary: job title */}
        <p className={`text-[12px] truncate mt-0.5 ${isOverdue ? "text-paper/70" : "text-muted-foreground"}`}>
          {quote.title}
        </p>
        {/* Status / hint chip row */}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold ${STATUS_CHIP[quote.status]}`}>
            {STATUS_LABEL[quote.status]}
          </span>
          {acceptedMaterials > 0 && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold ${isOverdue ? "bg-paper/15 text-paper/80" : "bg-secondary text-ink/80"}`}>
              <ShoppingCart className="h-3 w-3" />
              {acceptedMaterials} material{acceptedMaterials === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
      {/* Right: amount */}
      <div className="shrink-0 text-right">
        <p
          className={`leading-none tabular-nums ${isOverdue ? "text-lime" : "text-ink"}`}
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.75rem", letterSpacing: "0.01em" }}
        >
          {formatGBP(quote.total)}
        </p>
        {isOverdue && (
          <p className="text-[10px] uppercase tracking-widest font-bold text-paper/60 mt-1">
            Swipe to chase
          </p>
        )}
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

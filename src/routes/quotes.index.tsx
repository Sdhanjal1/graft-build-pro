import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
  pending: "bg-status-pending/15 text-status-pending",
  sent: "bg-status-sent/15 text-status-sent",
  accepted: "bg-status-booked/15 text-status-booked",
  declined: "bg-status-overdue/15 text-status-overdue",
  completed: "bg-status-completed/15 text-status-completed",
  paid: "bg-status-paid/15 text-status-paid",
  overdue: "bg-status-overdue/15 text-status-overdue",
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

  const filtered = mockQuotes.filter((x) => {
    if (tile && !tileMatches(tile, x)) return false;
    if (q && !`${x.title} ${x.ref}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <AppShell>
      <PageHeader title="Quotes" subtitle="All work" />

      {/* Pipeline tiles */}
      <div className="px-5 mt-4 grid grid-cols-2 gap-2.5">
        {tiles.map((t) => {
          const active = tile === t.key;
          const isOverdue = t.key === "overdue";
          const pulse = isOverdue && t.count > 0;
          return (
            <button
              key={t.key}
              onClick={() => setTile(active ? null : t.key)}
              className={`relative text-left rounded-2xl px-4 py-3.5 border transition ${
                active
                  ? "bg-ink text-paper border-ink"
                  : "bg-card text-ink border-border hover:border-ink/30"
              } ${pulse ? "motion-safe:animate-pulse-soft" : ""}`}
              aria-pressed={active}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] uppercase tracking-widest font-semibold ${active ? "text-paper/70" : "text-muted-foreground"}`}>
                  {TILE_LABEL[t.key]}
                </span>
                <span className={`text-[10px] font-bold tabular-nums ${active ? "text-paper" : isOverdue && t.count > 0 ? "text-status-overdue" : "text-ink/60"}`}>
                  {t.count}
                </span>
              </div>
              <CountUpGBP
                value={t.total}
                className={`mt-1.5 block text-xl font-bold leading-none tabular-nums ${active ? "text-paper" : "text-ink"}`}
              />

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
      <div className="shrink-0">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold ${STATUS_PILL[quote.status]}`}>
          {STATUS_LABEL[quote.status]}
        </span>
      </div>
    </Link>
  );
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function CountUpGBP({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const to = value;
    if (from === to) {
      setDisplay(to);
      return;
    }
    const duration = 420;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);
  return <span className={className}>{formatGBP(display)}</span>;
}

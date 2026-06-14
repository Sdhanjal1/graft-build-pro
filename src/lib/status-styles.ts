import type { QuoteStatus } from "@/lib/user-data";

/**
 * Single source of truth for quote-status visual language.
 * Used by both quotes.index and chaser so chips, dots and labels
 * read identically across every list.
 *
 * Semantics:
 * - pending / sent       → neutral ink (awaiting customer)
 * - accepted / completed → lime-ish (good, work in flight)
 * - paid                 → solid lime (positive end-state)
 * - overdue              → solid red (urgent)
 * - declined             → muted strike-through
 */

export const STATUS_LABEL: Record<QuoteStatus, string> = {
  pending: "Draft",
  sent: "Awaiting",
  accepted: "Booked",
  declined: "Declined",
  completed: "Completed",
  paid: "Paid",
  overdue: "Overdue",
};


export const STATUS_CHIP: Record<QuoteStatus, string> = {
  pending: "bg-ink/8 text-muted-foreground",
  sent: "bg-ink/8 text-muted-foreground",
  accepted: "bg-lime/30 text-ink",
  declined: "bg-ink/8 text-muted-foreground line-through",
  completed: "bg-lime/20 text-ink",
  paid: "bg-lime text-ink",
  overdue: "bg-status-overdue text-white",
};

export const STATUS_DOT: Record<QuoteStatus, string> = {
  pending: "bg-status-pending",
  sent: "bg-status-pending",
  accepted: "bg-lime",
  declined: "bg-muted-foreground",
  completed: "bg-lime",
  paid: "bg-lime",
  overdue: "bg-status-overdue",
};

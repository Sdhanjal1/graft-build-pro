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


// Bold Cashboard: solid pill chips — every status reads at the same weight,
// the colour does the talking. Tiny tracking-tight uppercase labels.
export const STATUS_CHIP: Record<QuoteStatus, string> = {
  pending: "bg-secondary text-ink",
  sent: "bg-secondary text-ink",
  accepted: "bg-ink text-paper",
  declined: "bg-secondary text-muted-foreground line-through",
  completed: "bg-ink text-paper",
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

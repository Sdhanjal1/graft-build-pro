import type { QuoteStatus } from "@/lib/user-data";

/**
 * Single source of truth for quote-status visual language.
 * Used by quotes list, customer detail job history, chaser, inbox.
 *
 * Restrained dot-based status system — a small filled circle precedes
 * the label, never a full coloured pill. Goal: glanceable triage.
 *
 *   Draft     → neutral grey
 *   Sent      → amber
 *   Accepted  → lime
 *   Paid      → green
 *   Overdue   → red
 *   Declined  → muted
 *   Completed → lime
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

// Dot-only treatment. Label rides next to it in muted ink — no full pill fill.
export const STATUS_CHIP: Record<QuoteStatus, string> = {
  pending: "text-muted-foreground",
  sent: "text-ink",
  accepted: "text-ink",
  declined: "text-muted-foreground line-through",
  completed: "text-ink",
  paid: "text-ink",
  overdue: "text-status-overdue",
};

export const STATUS_DOT: Record<QuoteStatus, string> = {
  pending: "bg-muted-foreground/60",
  sent: "bg-status-amber",
  accepted: "bg-lime",
  declined: "bg-muted-foreground/40",
  completed: "bg-lime",
  paid: "bg-status-green",
  overdue: "bg-status-overdue",
};

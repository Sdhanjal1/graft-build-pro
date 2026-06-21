import { Check } from "lucide-react";
import type { QuoteStatus } from "@/lib/user-data";

/**
 * Unified status pill — single source of truth for every quote / payment
 * state across the app (quote list, quote detail, customer portal, invoice).
 *
 * New brand status set:
 *   draft | sent | accepted | deposit-paid | balance-due | paid |
 *   failed | declined | overdue
 *
 * Legacy `QuoteStatus` (pending|sent|accepted|declined|completed|paid|overdue)
 * and the historical "invoiced" variant are accepted via the same prop and
 * mapped onto the new palette so existing call sites compile unchanged.
 */
export type StatusBadgeStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "deposit-paid"
  | "balance-due"
  | "paid"
  | "failed"
  | "declined"
  | "overdue";

type LegacyStatus = QuoteStatus | "invoiced";
type AnyStatus = StatusBadgeStatus | LegacyStatus;

const LEGACY_MAP: Record<LegacyStatus, StatusBadgeStatus> = {
  pending: "draft",
  sent: "sent",
  accepted: "accepted",
  declined: "declined",
  completed: "paid",
  paid: "paid",
  overdue: "overdue",
  invoiced: "balance-due",
};

function normalize(status: AnyStatus): StatusBadgeStatus {
  if (status in LEGACY_MAP) return LEGACY_MAP[status as LegacyStatus];
  return status as StatusBadgeStatus;
}

type Palette = {
  bg: string;       // background class
  text: string;     // label text class
  dot: string;      // dot/tick fill class
  label: string;
  awaiting?: boolean;  // pulse the dot
};

const PALETTE: Record<StatusBadgeStatus, Palette> = {
  draft:          { bg: "bg-ink-50",     text: "text-ink-400",   dot: "bg-ink-400",  label: "Draft" },
  sent:           { bg: "bg-sent-bg",    text: "text-sent-text", dot: "bg-sent",     label: "Sent", awaiting: true },
  accepted:       { bg: "bg-sent-bg",    text: "text-sent-text", dot: "bg-sent",     label: "Accepted" },
  "deposit-paid": { bg: "bg-paid-bg",    text: "text-paid-text", dot: "bg-paid",     label: "Deposit paid" },
  "balance-due":  { bg: "bg-due-bg",     text: "text-due-text",  dot: "bg-due",      label: "Balance due" },
  overdue:        { bg: "bg-due-bg",     text: "text-due-text",  dot: "bg-due",      label: "Overdue", awaiting: true },
  paid:           { bg: "bg-paid-bg",    text: "text-paid-text", dot: "bg-paid",     label: "Paid" },
  failed:         { bg: "bg-failed-bg",  text: "text-failed-text", dot: "bg-failed", label: "Payment failed" },
  declined:       { bg: "bg-failed-bg",  text: "text-failed-text", dot: "bg-failed", label: "Declined" },
};

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency", currency: "GBP", maximumFractionDigits: 0,
});

export function StatusBadge({
  status,
  amount,
}: {
  status: AnyStatus;
  /** Optional money amount appended to the label (e.g. "Paid · £1,250"). */
  amount?: number;
}) {
  const key = normalize(status);
  // Fallback to draft for any unknown value rather than rendering a broken pill.
  const p: Palette = PALETTE[key] ?? PALETTE.draft;
  const isPaid = key === "paid" || key === "deposit-paid";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--r-md)] px-2.5 py-1 text-xs font-semibold ${p.bg} ${p.text}`}
    >
      {isPaid ? (
        <Check
          className={`h-3 w-3 ${p.text} animate-scale-in`}
          style={{ animationDuration: "300ms", animationTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
          strokeWidth={3}
          aria-hidden
        />
      ) : p.awaiting ? (
        <span className="relative inline-flex h-2 w-2" aria-hidden>
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping ${p.dot}`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${p.dot}`} />
        </span>
      ) : (
        <span className={`inline-flex h-2 w-2 rounded-full ${p.dot}`} aria-hidden />
      )}
      <span>{p.label}</span>
      {typeof amount === "number" && Number.isFinite(amount) ? (
        <span className="num font-semibold opacity-80">· {GBP.format(amount)}</span>
      ) : null}
    </span>
  );
}

import { Check } from "lucide-react";
import type { QuoteStatus } from "@/lib/user-data";

type Variant = QuoteStatus | "invoiced";

const styles: Record<Variant, string> = {
  pending: "bg-status-pending/15 text-status-pending",
  sent: "bg-status-pending/15 text-status-pending",
  accepted: "bg-status-booked/15 text-status-booked",
  declined: "bg-muted text-muted-foreground line-through",
  invoiced: "bg-ink text-paper",
  completed: "bg-status-completed/15 text-status-completed",
  paid: "bg-lime/30 text-ink",
  overdue: "bg-status-overdue/15 text-status-overdue",
};

const labels: Record<Variant, string> = {
  pending: "pending",
  sent: "sent",
  accepted: "booked",
  declined: "declined",
  invoiced: "invoiced",
  completed: "completed",
  paid: "paid",
  overdue: "overdue",
};

// Steady coloured dot for booked/completed; pulsing lime dot for pending/sent (awaiting action).
function StatusDot({ status }: { status: Variant }) {
  if (status === "pending" || status === "sent") {
    return (
      <span className="relative inline-flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-lime" />
      </span>
    );
  }
  if (status === "accepted") {
    return <span className="inline-flex h-2 w-2 rounded-full bg-status-booked" />;
  }
  if (status === "completed") {
    return <span className="inline-flex h-2 w-2 rounded-full bg-status-completed" />;
  }
  if (status === "overdue") {
    return <span className="inline-flex h-2 w-2 rounded-full bg-status-overdue" />;
  }
  return null;
}

export function StatusBadge({ status }: { status: Variant }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide ${styles[status]}`}
    >
      {status === "paid" ? (
        <Check
          key="paid-check"
          className="h-3 w-3 animate-scale-in"
          style={{ animationDuration: "300ms", animationTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
          strokeWidth={3}
        />
      ) : (
        <StatusDot status={status} />
      )}
      {labels[status]}
    </span>
  );
}

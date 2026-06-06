import { Check } from "lucide-react";
import type { QuoteStatus } from "@/lib/user-data";

type Variant = QuoteStatus | "invoiced";

const styles: Record<Variant, string> = {
  pending: "bg-ink/10 text-ink",
  sent: "bg-ink/10 text-ink",
  accepted: "bg-lime/25 text-ink border border-lime",
  declined: "bg-ink/10 text-muted-foreground line-through",
  invoiced: "bg-ink text-paper",
  completed: "bg-ink/10 text-ink",
  paid: "bg-lime text-ink",
  overdue: "bg-status-overdue text-white",
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
    return <span className="inline-flex h-2 w-2 rounded-full bg-lime" />;
  }
  if (status === "completed") {
    return <span className="inline-flex h-2 w-2 rounded-full bg-ink/40" />;
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

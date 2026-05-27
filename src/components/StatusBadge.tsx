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

export function StatusBadge({ status }: { status: Variant }) {
  const isPending = status === "pending";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide ${styles[status]}`}
    >
      {isPending && (
        <span className="relative inline-flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-pending opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-status-pending" />
        </span>
      )}
      {labels[status]}
    </span>
  );
}

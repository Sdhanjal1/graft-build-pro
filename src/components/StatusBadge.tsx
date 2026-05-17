import type { QuoteStatus } from "@/lib/mock-data";

const styles: Record<QuoteStatus, string> = {
  pending: "bg-status-pending/15 text-status-pending",
  accepted: "bg-status-accepted/15 text-status-accepted",
  paid: "bg-lime/30 text-ink",
  overdue: "bg-status-overdue/15 text-status-overdue",
};

export function StatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide ${styles[status]}`}
    >
      {status}
    </span>
  );
}

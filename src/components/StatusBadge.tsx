import { Check } from "lucide-react";
import type { QuoteStatus } from "@/lib/user-data";
import { STATUS_DOT, STATUS_LABEL } from "@/lib/status-styles";

type Variant = QuoteStatus | "invoiced";

// "invoiced" isn't part of QuoteStatus — map it onto the closest dot/label.
const dotForVariant = (v: Variant): string =>
  v === "invoiced" ? "bg-ink" : STATUS_DOT[v];

const labelForVariant = (v: Variant): string =>
  v === "invoiced" ? "Invoiced" : STATUS_LABEL[v];

const textForVariant = (v: Variant): string => {
  if (v === "overdue") return "text-status-overdue";
  if (v === "declined") return "text-muted-foreground line-through";
  if (v === "pending") return "text-muted-foreground";
  return "text-ink";
};

export function StatusBadge({ status }: { status: Variant }) {
  // Pulse the dot when awaiting customer action.
  const isAwaiting = status === "pending" || status === "sent";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${textForVariant(status)}`}
    >
      {status === "paid" ? (
        <Check
          key="paid-check"
          className="h-3 w-3 text-status-green animate-scale-in"
          style={{ animationDuration: "300ms", animationTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
          strokeWidth={3}
        />
      ) : isAwaiting ? (
        <span className="relative inline-flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-70 ${dotForVariant(status)}`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotForVariant(status)}`} />
        </span>
      ) : (
        <span className={`inline-flex h-2 w-2 rounded-full ${dotForVariant(status)}`} />
      )}
      {labelForVariant(status)}
    </span>
  );
}

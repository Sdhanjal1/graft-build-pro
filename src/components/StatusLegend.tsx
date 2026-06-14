import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { STATUS_LABEL, STATUS_CHIP } from "@/lib/status-styles";
import type { QuoteStatus } from "@/lib/user-data";

type Item = { key: QuoteStatus; hint: string };

const DEFAULT_ITEMS: Item[] = [
  { key: "pending", hint: "Not sent yet" },
  { key: "sent", hint: "Waiting on client reply" },
  { key: "accepted", hint: "Client said yes" },
  { key: "completed", hint: "Job done, ready to invoice" },
  { key: "paid", hint: "Money in" },
  { key: "overdue", hint: "Past due date" },
];

/**
 * Compact, collapsible status legend.
 * Shows what each chip colour means without taking permanent vertical space.
 * Persists state in sessionStorage so it stays closed once dismissed per session.
 */
export function StatusLegend({
  items = DEFAULT_ITEMS,
  storageKey = "quottr.statusLegend.open",
}: {
  items?: Item[];
  storageKey?: string;
}) {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(storageKey) === "1";
  });

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey, next ? "1" : "0");
    }
  };

  return (
    <div className="rounded-2xl bg-card/60 border border-border/60">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-3.5 py-2 text-[11px] uppercase tracking-wider font-bold text-muted-foreground active:scale-[0.99] transition-transform"
      >
        <span className="inline-flex items-center gap-1.5">
          <Info className="h-3 w-3" />
          What the colours mean
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3.5 pb-3 pt-1 flex flex-wrap gap-x-3 gap-y-2 animate-fade-in">
          {items.map((it) => (
            <div key={it.key} className="flex items-center gap-1.5 min-w-0">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold ${STATUS_CHIP[it.key]}`}>
                {STATUS_LABEL[it.key]}
              </span>
              <span className="text-[11px] text-muted-foreground truncate">{it.hint}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

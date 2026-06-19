import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Copy, Send, Trash2 } from "lucide-react";
import { feedback } from "@/lib/feedback";

export type QuoteQuickAction = "duplicate" | "mark-sent" | "delete";

export function QuoteQuickActionsSheet({
  open,
  onOpenChange,
  quoteRef,
  canMarkSent,
  onAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteRef: string;
  canMarkSent: boolean;
  onAction: (action: QuoteQuickAction) => void;
}) {
  const handle = (action: QuoteQuickAction) => {
    feedback("tap");
    onOpenChange(false);
    // Defer slightly so the sheet close animation can begin before the work fires.
    setTimeout(() => onAction(action), 0);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-0 bg-card p-0">
        <SheetHeader className="px-5 pt-5 pb-2 text-left">
          <SheetTitle className="text-base text-muted-foreground font-normal">
            Quick actions · {quoteRef}
          </SheetTitle>
        </SheetHeader>
        <div className="px-3 pb-6 pt-2 flex flex-col">
          <ActionRow
            icon={<Copy className="h-5 w-5" />}
            label="Duplicate"
            onClick={() => handle("duplicate")}
          />
          {canMarkSent && (
            <ActionRow
              icon={<Send className="h-5 w-5" />}
              label="Mark sent"
              onClick={() => handle("mark-sent")}
            />
          )}
          <ActionRow
            icon={<Trash2 className="h-5 w-5" />}
            label="Delete"
            destructive
            onClick={() => handle("delete")}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ActionRow({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-4 px-4 py-4 rounded-2xl text-left text-base font-medium transition active:bg-muted ${
        destructive ? "text-status-overdue" : "text-ink"
      }`}
    >
      <span
        className={`h-10 w-10 rounded-full flex items-center justify-center ${
          destructive ? "bg-status-overdue/10" : "bg-muted"
        }`}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}

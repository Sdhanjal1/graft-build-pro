import { useState } from "react";
import { toast } from "sonner";
import { Check, Share2, Loader2, X, ShoppingCart } from "lucide-react";
import {
  buildMaterialsShareText,
  materialsForQuote,
  setQuoteMaterialsPurchased,
  userProfile,
  type Quote,
} from "@/lib/user-data";
import { resolveTrade } from "@/lib/trades";
import { feedback } from "@/lib/feedback";

type Props = {
  open: boolean;
  onClose: () => void;
  quote: Quote;
  customerName?: string;
};

export function MaterialListSheet({ open, onClose, quote, customerName }: Props) {
  const initial = materialsForQuote(quote);
  const [checks, setChecks] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(initial.map((m) => [m.index, m.purchased])),
  );
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);

  if (!open) return null;

  const mats = materialsForQuote(quote).map((m) => ({
    ...m,
    purchased: checks[m.index] ?? m.purchased,
  }));

  const toggle = (index: number) => {
    feedback("tap");
    const next = { ...checks, [index]: !(checks[index] ?? false) };
    // optimistic local state — also for initial values from the quote
    if (checks[index] === undefined) {
      const existing = mats.find((m) => m.index === index)?.purchased ?? false;
      next[index] = !existing;
    }
    setChecks(next);
    void persist(next);
  };

  const persist = async (state: Record<number, boolean>) => {
    setSaving(true);
    try {
      const arr = quote.line_items.map((_, i) => state[i] ?? !!quote.materials_purchased?.[i]);
      await setQuoteMaterialsPurchased(quote.id, arr);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    const text = buildMaterialsShareText(quote, customerName);
    setSharing(true);
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: `Materials — ${quote.title}`, text });
          feedback("success");
          return;
        } catch {
          /* user cancelled — fall through to clipboard */
        }
      }
      await navigator.clipboard.writeText(text);
      toast.success("Materials list copied");
      feedback("success");
    } catch (e) {
      feedback("error");
      toast.error(e instanceof Error ? e.message : "Could not share list");
    } finally {
      setSharing(false);
    }
  };

  const total = mats.length;
  const done = mats.filter((m) => m.purchased).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/60" onClick={onClose}>
      <div
        className="w-full max-w-md mx-auto bg-paper rounded-t-3xl p-5 pb-8 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-10 bg-ink/20 rounded-full mx-auto mb-4" />

        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-lime text-ink flex items-center justify-center shrink-0">
            <ShoppingCart className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-2xl leading-tight">Material list</h3>
            <p className="text-xs text-muted-foreground truncate">
              {quote.title}
              {customerName ? ` · ${customerName}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-full bg-secondary inline-flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between mb-3 text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
            <span>{total} item{total === 1 ? "" : "s"}</span>
            <span>
              {done}/{total} bought
              {saving && <Loader2 className="inline-block h-3 w-3 animate-spin ml-1.5" />}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {mats.length === 0 ? (
            <div className="card-surface p-6 text-center text-sm text-muted-foreground">
              No {resolveTrade(userProfile.trade_type).materialPhrase} on this quote yet.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {mats.map((m) => (
                <li key={m.index}>
                  <button
                    onClick={() => toggle(m.index)}
                    className={`w-full text-left rounded-2xl border p-3.5 flex items-start gap-3 transition ${
                      m.purchased
                        ? "bg-lime/15 border-lime/40"
                        : "bg-card border-border hover:bg-secondary/60"
                    }`}
                  >
                    <span
                      className={`mt-0.5 h-6 w-6 rounded-full inline-flex items-center justify-center shrink-0 border-2 ${
                        m.purchased
                          ? "bg-ink border-ink text-lime"
                          : "border-muted-foreground/40 text-transparent"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-semibold leading-snug ${
                          m.purchased ? "line-through text-muted-foreground" : "text-ink"
                        }`}
                      >
                        {m.qty}x {m.description}
                      </p>
                      {m.supplier_code && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Code: <span className="num">{m.supplier_code}</span>
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={handleShare}
          disabled={sharing || mats.length === 0}
          className="mt-4 w-full bg-ink text-paper rounded-full py-3.5 font-bold inline-flex items-center justify-center gap-2 text-sm disabled:opacity-50"
        >
          {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          Share list
        </button>
      </div>
    </div>
  );
}

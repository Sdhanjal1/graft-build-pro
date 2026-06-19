import { useState } from "react";
import { toast } from "sonner";
import { Check, Share2, Loader2, X, ShoppingCart, Plus, Trash2 } from "lucide-react";
import {
  buildMaterialsShareText,
  materialsForQuote,
  addMaterialItem,
  setMaterialPurchased,
  removeMaterialItem,
  type Quote,
} from "@/lib/user-data";
import { feedback } from "@/lib/feedback";

type Props = {
  open: boolean;
  onClose: () => void;
  quote: Quote;
  customerName?: string;
};

export function MaterialListSheet({ open, onClose, quote, customerName }: Props) {
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState("1");

  if (!open) return null;

  const mats = materialsForQuote(quote);

  const toggle = async (itemId: string, current: boolean) => {
    feedback("tap");
    setSaving(true);
    try {
      await setMaterialPurchased(quote.id, itemId, !current);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (itemId: string) => {
    feedback("tap");
    setSaving(true);
    try {
      await removeMaterialItem(quote.id, itemId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const description = desc.trim();
    if (!description) return;
    const quantity = Math.max(1, Math.floor(Number(qty) || 1));
    setAdding(true);
    try {
      await addMaterialItem(quote.id, { description, qty: quantity });
      setDesc("");
      setQty("1");
      feedback("success");
    } catch (err) {
      feedback("error");
      toast.error(err instanceof Error ? err.message : "Couldn't add item");
    } finally {
      setAdding(false);
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
      toast.error(e instanceof Error ? e.message : "Couldn't share list");
    } finally {
      setSharing(false);
    }
  };

  const total = mats.length;
  const done = mats.filter((m) => m.purchased).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/60" onClick={onClose}>
      <div
        className="w-full max-w-md mx-auto bg-paper rounded-t-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] max-h-[90vh] flex flex-col"
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
              No materials yet. Add what you need to buy for this job below.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {mats.map((m) => (
                <li key={m.id} className="flex items-stretch gap-1.5">
                  <button
                    onClick={() => toggle(m.id, m.purchased)}
                    className={`flex-1 text-left rounded-2xl border p-3.5 flex items-start gap-3 transition ${
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
                    </div>
                  </button>
                  <button
                    onClick={() => remove(m.id)}
                    aria-label="Remove"
                    className="w-10 rounded-2xl bg-secondary/60 hover:bg-secondary inline-flex items-center justify-center text-muted-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={handleAdd} className="mt-4 flex items-center gap-1.5">
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Add material…"
            className="flex-1 h-11 rounded-full border border-border bg-card px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20"
          />
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="numeric"
            aria-label="Quantity"
            className="w-14 h-11 rounded-full border border-border bg-card px-3 text-sm text-center focus:outline-none focus:ring-2 focus:ring-ink/20"
          />
          <button
            type="submit"
            disabled={adding || !desc.trim()}
            aria-label="Add"
            className="h-11 w-11 rounded-full bg-ink text-paper inline-flex items-center justify-center disabled:opacity-50"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
        </form>

        <button
          onClick={handleShare}
          disabled={sharing || mats.length === 0}
          className="mt-3 w-full bg-ink text-paper rounded-full py-3.5 font-bold inline-flex items-center justify-center gap-2 text-sm disabled:opacity-50"
        >
          {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          Share list
        </button>
      </div>
    </div>
  );
}

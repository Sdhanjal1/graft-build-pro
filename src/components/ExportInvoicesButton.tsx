import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Range = "this" | "last" | "custom";

// UK tax year runs 6 April → 5 April
function ukTaxYearRange(offset: 0 | 1): { from: Date; to: Date } {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), 3, 6); // 6 April this year
  const startYear = (now >= cutoff ? now.getFullYear() : now.getFullYear() - 1) - offset;
  const from = new Date(startYear, 3, 6);
  const to = new Date(startYear + 1, 3, 5, 23, 59, 59, 999);
  return { from, to };
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function ExportInvoicesButton() {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<Range>("this");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [busy, setBusy] = useState(false);

  function resolveRange(): { from: Date; to: Date; label: string } | null {
    if (range === "this") {
      const r = ukTaxYearRange(0);
      return { ...r, label: `tax-year-${r.from.getFullYear()}-${String(r.to.getFullYear()).slice(2)}` };
    }
    if (range === "last") {
      const r = ukTaxYearRange(1);
      return { ...r, label: `tax-year-${r.from.getFullYear()}-${String(r.to.getFullYear()).slice(2)}` };
    }
    if (!customFrom || !customTo) return null;
    const from = new Date(customFrom);
    const to = new Date(customTo);
    to.setHours(23, 59, 59, 999);
    if (isNaN(+from) || isNaN(+to) || from > to) return null;
    return { from, to, label: `${customFrom}_to_${customTo}` };
  }

  async function handleExport() {
    const r = resolveRange();
    if (!r) {
      toast.error("Pick a valid date range");
      return;
    }
    setBusy(true);
    try {
      const { data: quotes, error } = await supabase
        .from("quotes")
        .select("id, ref, title, job_description, subtotal, vat_amount, total, payment_method, paid_via, invoiced_at, updated_at, created_at, client_id")
        .eq("status", "paid")
        .gte("updated_at", r.from.toISOString())
        .lte("updated_at", r.to.toISOString())
        .order("updated_at", { ascending: true });
      if (error) throw error;

      const clientIds = Array.from(new Set((quotes ?? []).map((q) => q.client_id).filter(Boolean))) as string[];
      const clientMap = new Map<string, string>();
      if (clientIds.length) {
        const { data: clients } = await supabase.from("clients").select("id, name").in("id", clientIds);
        for (const c of clients ?? []) clientMap.set(c.id, c.name ?? "");
      }

      const header = ["Date", "Client name", "Job description", "Quote ref", "Amount (ex VAT)", "VAT", "Total", "Payment method"];
      const rows = (quotes ?? []).map((q) => {
        const date = q.invoiced_at ?? q.updated_at ?? q.created_at;
        return [
          date ? format(new Date(date), "yyyy-MM-dd") : "",
          q.client_id ? clientMap.get(q.client_id) ?? "" : "",
          q.job_description ?? q.title ?? "",
          q.ref ?? "",
          Number(q.subtotal ?? 0).toFixed(2),
          Number(q.vat_amount ?? 0).toFixed(2),
          Number(q.total ?? 0).toFixed(2),
          q.payment_method ?? q.paid_via ?? "",
        ];
      });

      const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Quottr-export-${r.label}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${rows.length} invoice${rows.length === 1 ? "" : "s"}`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-3 text-sm font-medium hover:bg-accent"
      >
        <Download className="h-4 w-4" />
        Export invoices
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export invoices</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {([
              ["this", "This tax year"],
              ["last", "Last tax year"],
              ["custom", "Custom range"],
            ] as const).map(([val, label]) => (
              <label key={val} className="flex items-center gap-3 p-3 rounded-md border border-input cursor-pointer">
                <input
                  type="radio"
                  name="range"
                  value={val}
                  checked={range === val}
                  onChange={() => setRange(val)}
                />
                <span className="text-sm font-medium">{label}</span>
              </label>
            ))}
            {range === "custom" && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <Label htmlFor="from" className="text-xs">From</Label>
                  <Input id="from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="to" className="text-xs">To</Label>
                  <Input id="to" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={handleExport} disabled={busy}>
              {busy ? "Exporting…" : "Download CSV"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

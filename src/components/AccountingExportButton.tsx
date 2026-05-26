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
import { userProfile, type LineItem, type LineItemCategory } from "@/lib/user-data";

type Range = "this" | "last" | "custom";
type Software = "" | "xero" | "quickbooks" | "freeagent" | "sage" | "other" | "none";

const SOFTWARE_LABEL: Record<Exclude<Software, "">, string> = {
  xero: "Xero",
  quickbooks: "QuickBooks",
  freeagent: "FreeAgent",
  sage: "Sage",
  other: "records (CSV)",
  none: "records (CSV)",
};

function buttonLabel(sw: Software): string {
  if (!sw || sw === "other" || sw === "none") return "Download records (CSV)";
  return `Download for ${SOFTWARE_LABEL[sw]}`;
}

function ukTaxYearRange(offset: 0 | 1): { from: Date; to: Date } {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), 3, 6);
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

type TaxKind = "standard" | "zero" | "exempt" | "reverse" | "novat";

function taxKindFor(q: { vat_registered?: boolean; vat_amount?: number; subtotal?: number }): TaxKind {
  if (!q.vat_registered) return "novat";
  const vat = Number(q.vat_amount ?? 0);
  const sub = Number(q.subtotal ?? 0);
  if (vat <= 0 || sub <= 0) return "zero";
  return "standard";
}

function taxValue(kind: TaxKind, sw: Exclude<Software, "">): string {
  const map: Record<TaxKind, Record<Exclude<Software, "">, string>> = {
    standard: { xero: "Output VAT 20%", quickbooks: "Standard 20%", freeagent: "Standard", sage: "T1", other: "Standard 20%", none: "Standard 20%" },
    zero:     { xero: "Zero Rated",     quickbooks: "Zero Rated",   freeagent: "Zero",     sage: "T0", other: "Zero Rated",   none: "Zero Rated" },
    exempt:   { xero: "Exempt",         quickbooks: "Exempt",       freeagent: "Exempt",   sage: "T2", other: "Exempt",       none: "Exempt" },
    reverse:  { xero: "Reverse Charge", quickbooks: "Reverse Charges (20%)", freeagent: "Reverse Charge", sage: "T20", other: "Reverse Charge", none: "Reverse Charge" },
    novat:    { xero: "No VAT",         quickbooks: "Out Of Scope", freeagent: "Out Of Scope", sage: "T9", other: "No VAT",   none: "No VAT" },
  };
  return map[kind][sw];
}

const HEADERS: Record<Exclude<Software, "">, string[]> = {
  xero:       ["Date", "ContactName", "InvoiceNumber", "Reference", "Description", "Quantity", "UnitAmount", "AccountCode", "TaxType"],
  quickbooks: ["Date", "Customer",    "InvoiceNo",     "Reference", "Description", "Quantity", "Rate",       "Account",     "Tax"],
  freeagent:  ["Date", "Contact",     "InvoiceReference", "Description", "Quantity", "Price",   "Category",   "VATRate"],
  sage:       ["Date", "Customer",    "InvoiceNumber", "Description", "Quantity", "NetAmount", "NominalCode","TaxCode"],
  other:      ["Date", "Customer",    "Invoice Number","Description", "Quantity", "Net Amount","Account Code","Tax Treatment"],
  none:       ["Date", "Customer",    "Invoice Number","Description", "Quantity", "Net Amount","Account Code","Tax Treatment"],
};

export function AccountingExportButton({ helperText }: { helperText?: string }) {
  const software: Software = userProfile.accounting_software || "";
  const sw: Exclude<Software, ""> = (software || "none") as Exclude<Software, "">;
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<Range>("this");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [busy, setBusy] = useState(false);

  function resolveRange() {
    if (range === "this") {
      const r = ukTaxYearRange(0);
      return { ...r, label: `${format(r.from, "yyyy-MM-dd")}-to-${format(r.to, "yyyy-MM-dd")}` };
    }
    if (range === "last") {
      const r = ukTaxYearRange(1);
      return { ...r, label: `${format(r.from, "yyyy-MM-dd")}-to-${format(r.to, "yyyy-MM-dd")}` };
    }
    if (!customFrom || !customTo) return null;
    const from = new Date(customFrom);
    const to = new Date(customTo);
    to.setHours(23, 59, 59, 999);
    if (isNaN(+from) || isNaN(+to) || from > to) return null;
    return { from, to, label: `${customFrom}-to-${customTo}` };
  }

  async function handleExport() {
    const r = resolveRange();
    if (!r) { toast.error("Pick a valid date range"); return; }
    setBusy(true);
    try {
      const { data: quotes, error } = await supabase
        .from("quotes")
        .select("id, ref, title, job_description, line_items, subtotal, vat_amount, total, vat_registered, invoiced_at, updated_at, created_at, client_id")
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

      const codes = userProfile.accounting_codes;
      const hasAnyCodes = Object.values(codes).some((c) => c && c.trim());
      const codeFor = (cat?: LineItemCategory) => {
        const k = (cat ?? "other") as LineItemCategory;
        const v = codes[k];
        return v && v.trim() ? v.trim() : "200";
      };

      const header = HEADERS[sw];
      const rows: string[][] = [header];

      for (const q of quotes ?? []) {
        const date = q.invoiced_at ?? q.updated_at ?? q.created_at;
        const dateStr = date ? format(new Date(date), "yyyy-MM-dd") : "";
        const customer = q.client_id ? clientMap.get(q.client_id) ?? "" : "";
        const invoiceNo = q.ref ?? "";
        const reference = q.title ?? "";
        const kind = taxKindFor(q as { vat_registered?: boolean; vat_amount?: number; subtotal?: number });
        const tax = taxValue(kind, sw);
        const items: LineItem[] = Array.isArray(q.line_items) ? (q.line_items as unknown as LineItem[]) : [];
        const safeItems = items.length ? items : [{ description: q.title ?? "", qty: 1, unit_price: Number(q.subtotal ?? 0), category: "other" as const }];

        for (const li of safeItems) {
          const qty = Number(li.qty ?? 1);
          const unit = Number(li.unit_price ?? 0).toFixed(2);
          const account = codeFor(li.category);
          const desc = li.description ?? "";
          if (sw === "freeagent") {
            rows.push([dateStr, customer, invoiceNo, desc, String(qty), unit, account, tax]);
          } else if (sw === "xero" || sw === "quickbooks") {
            rows.push([dateStr, customer, invoiceNo, reference, desc, String(qty), unit, account, tax]);
          } else {
            // sage / other / none
            rows.push([dateStr, customer, invoiceNo, desc, String(qty), unit, account, tax]);
          }
        }
      }

      const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const swSlug = sw === "none" ? "records" : sw;
      a.download = `Quottr-${swSlug}-export-${r.label}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const lineCount = rows.length - 1;
      toast.success(`Exported ${lineCount} line${lineCount === 1 ? "" : "s"}`);
      if (!hasAnyCodes) {
        toast("Set up your accounting codes in Settings for cleaner exports.");
      }
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {helperText && <p className="text-xs text-muted-foreground mb-1.5">{helperText}</p>}
      <button
        onClick={() => setOpen(true)}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-3 text-sm font-medium hover:bg-accent"
      >
        <Download className="h-4 w-4" />
        {buttonLabel(software)}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{buttonLabel(software)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {([
              ["this", "This tax year"],
              ["last", "Last tax year"],
              ["custom", "Custom range"],
            ] as const).map(([val, label]) => (
              <label key={val} className="flex items-center gap-3 p-3 rounded-md border border-input cursor-pointer">
                <input type="radio" name="acc-range" value={val} checked={range === val} onChange={() => setRange(val)} />
                <span className="text-sm font-medium">{label}</span>
              </label>
            ))}
            {range === "custom" && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <Label htmlFor="acc-from" className="text-xs">From</Label>
                  <Input id="acc-from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="acc-to" className="text-xs">To</Label>
                  <Input id="acc-to" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={handleExport} disabled={busy}>{busy ? "Exporting…" : "Download CSV"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

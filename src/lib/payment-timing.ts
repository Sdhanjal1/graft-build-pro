/**
 * Payment timing helpers (pure, isomorphic).
 * Used by the trader's quote detail screen, the customer portal,
 * the AI quote insert path, and the chaser.
 */

export type PaymentTiming =
  | "on_completion"
  | "deposit_then_balance"
  | "upfront";

export const PAYMENT_TIMING_OPTIONS: { value: PaymentTiming; label: string; sub: string }[] = [
  { value: "on_completion", label: "On completion", sub: "Customer pays after work is done" },
  { value: "deposit_then_balance", label: "Deposit then balance", sub: "Deposit upfront, balance on completion" },
  { value: "upfront", label: "Upfront", sub: "Full payment before work starts" },
];

const DEFAULT_DEPOSIT_PCT_FALLBACK = 30;

/** Auto-derive a sensible payment timing from a quote total. */
export function deriveTimingFromTotal(total: number): PaymentTiming {
  if (total < 500) return "on_completion";
  return "deposit_then_balance";
}

/** Compute deposit amount from subtotal + percentage. */
export function computeDepositAmount(subtotal: number, percent: number) {
  const pct = Math.max(0, Math.min(100, percent));
  return +((subtotal * pct) / 100).toFixed(2);
}

/** Compute deposit percentage from amount + subtotal. */
export function computeDepositPercent(subtotal: number, amount: number) {
  if (subtotal <= 0) return 0;
  const pct = (amount / subtotal) * 100;
  return Math.max(0, Math.min(100, +pct.toFixed(2)));
}

/** Parse a free-text input like "50%", "30 %", "£500", "500" into either pct or amount. */
export function parseDepositInput(raw: string): { kind: "pct" | "amount"; value: number } | null {
  const s = raw.trim().replace(/,/g, "");
  if (!s) return null;
  if (s.endsWith("%")) {
    const n = Number(s.slice(0, -1).trim());
    return Number.isFinite(n) ? { kind: "pct", value: n } : null;
  }
  const cleaned = s.replace(/^£/, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? { kind: "amount", value: n } : null;
}

export function formatGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);
}

/** Plain-English label for the trader's totals block / customer portal. */
export function paymentTimingLabel(opts: {
  timing: PaymentTiming;
  total: number;
  depositAmount: number;
  depositPercent: number;
}): string {
  const { timing, total, depositAmount, depositPercent } = opts;
  if (timing === "on_completion") return "Due on completion";
  if (timing === "upfront") return `${formatGBP(total)} upfront`;

  // deposit_then_balance
  const balance = Math.max(0, +(total - depositAmount).toFixed(2));
  const pctLabel = depositPercent ? ` (${Math.round(depositPercent)}%)` : "";
  return `${formatGBP(depositAmount)} deposit${pctLabel}, balance ${formatGBP(balance)} on completion`;
}

/** Accept-button label on customer portal. */
export function acceptButtonLabel(opts: {
  timing: PaymentTiming;
  total: number;
  depositAmount: number;
}): string {
  const { timing, total, depositAmount } = opts;
  if (timing === "on_completion") return "Accept quote — pay when complete";
  if (timing === "deposit_then_balance") return `Accept and pay deposit ${formatGBP(depositAmount)}`;
  if (timing === "upfront") return `Accept and pay ${formatGBP(total)}`;
  return "Accept quote";
}

export function defaultDepositPercent(profilePct?: number | null): number {
  const p = Number(profilePct);
  return Number.isFinite(p) && p > 0 ? p : DEFAULT_DEPOSIT_PCT_FALLBACK;
}

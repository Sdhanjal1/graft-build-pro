/**
 * Pure invoice amount arithmetic. No I/O. Single source of truth for
 * deposit / balance / headline computation across the four email modes:
 *
 *   - invoice           → final invoice for the full amount
 *   - receipt           → payment received (full OR remaining balance)
 *   - balance           → balance invoice = total − deposit paid
 *   - deposit-received  → deposit just paid; balance still owed
 *
 * Extracted from `invoice-email.server.ts` so we can unit-test the money
 * pipeline without mocking Supabase / Resend / jsPDF.
 *
 * All amounts are integer pence to avoid float drift.
 */

export type InvoiceMode = "invoice" | "receipt" | "balance" | "deposit-received";

export type ComputeInvoiceAmountsInput = {
  mode: InvoiceMode;
  totalCents: number;
  /** Caller-supplied headline. Optional for invoice/receipt; required for balance/deposit-received. */
  amountCents?: number;
  /** Already-paid deposit in pence, used by balance mode (and receipt auto-subtract). */
  depositPaidCents?: number;
};

export type InvoiceAmounts =
  | {
      ok: true;
      mode: InvoiceMode;
      /** Headline figure shown in the email subject + badge. */
      headlineCents: number;
      /** Outstanding balance after this email's headline is accounted for. */
      balanceDueCents: number;
      /** Total deposit credited toward this invoice so far. */
      depositPaidCents: number;
      /** Convenience: full quote total. */
      totalCents: number;
    }
  | {
      ok: false;
      reason: string;
    };

/**
 * Compute headline / balance / deposit figures for a given mode.
 *
 * Refuses (ok: false) on two well-known footguns:
 *   - balance mode with headline ≤ 0 (missing depositPaidCents)
 *   - deposit-received mode with headline ≤ 0 (no deposit to receive)
 */
export function computeInvoiceAmounts(
  input: ComputeInvoiceAmountsInput,
): InvoiceAmounts {
  const total = Math.max(0, Math.round(input.totalCents));
  const depositIn = Math.max(0, Math.round(input.depositPaidCents ?? 0));
  const amountIn =
    input.amountCents !== undefined
      ? Math.max(0, Math.round(input.amountCents))
      : undefined;

  if (input.mode === "invoice") {
    return {
      ok: true,
      mode: "invoice",
      headlineCents: amountIn ?? total,
      balanceDueCents: amountIn ?? total,
      depositPaidCents: 0,
      totalCents: total,
    };
  }

  if (input.mode === "receipt") {
    const headline = amountIn ?? total;
    // For a post-deposit receipt the caller passes (total − deposit). The
    // already-credited deposit shows for context but the balance is settled.
    const deposit = amountIn !== undefined
      ? depositIn
      : 0; // full-payment receipt: no prior deposit assumed unless caller says so
    return {
      ok: true,
      mode: "receipt",
      headlineCents: headline,
      balanceDueCents: 0,
      depositPaidCents: deposit,
      totalCents: total,
    };
  }

  if (input.mode === "balance") {
    // Headline defaults to total − deposit; refuse if non-positive.
    const headline = amountIn ?? Math.max(0, total - depositIn);
    if (headline <= 0) {
      return {
        ok: false,
        reason: "balance amount must be > 0 — check depositPaidCents",
      };
    }
    return {
      ok: true,
      mode: "balance",
      headlineCents: headline,
      balanceDueCents: headline,
      depositPaidCents: depositIn,
      totalCents: total,
    };
  }

  // deposit-received: caller MUST supply amountCents (the deposit just paid).
  const deposit = amountIn ?? 0;
  if (deposit <= 0) {
    return {
      ok: false,
      reason: "deposit amount must be > 0",
    };
  }
  return {
    ok: true,
    mode: "deposit-received",
    headlineCents: deposit,
    balanceDueCents: Math.max(0, total - deposit),
    depositPaidCents: deposit,
    totalCents: total,
  };
}

/**
 * Compute subtotal + VAT for a target total at a given VAT rate, rounded
 * to the penny so subtotal + vat === total exactly. Mirrors the same
 * rounding rule used by the PDF line-items / quote builder.
 */
export function computeVatToPenny(opts: {
  totalCents: number;
  vatRate: number; // e.g. 0.20 for 20%
  vatRegistered: boolean;
}): { subtotalCents: number; vatCents: number; totalCents: number } {
  const total = Math.max(0, Math.round(opts.totalCents));
  if (!opts.vatRegistered || opts.vatRate <= 0) {
    return { subtotalCents: total, vatCents: 0, totalCents: total };
  }
  // subtotal = total / (1 + rate), rounded to the penny.
  const subtotal = Math.round(total / (1 + opts.vatRate));
  const vat = total - subtotal;
  return { subtotalCents: subtotal, vatCents: vat, totalCents: total };
}

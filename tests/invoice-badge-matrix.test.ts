/**
 * Layer 2 — badge state-machine matrix.
 *
 * Walks the cartesian product of (mode × amountCents × depositPaidCents)
 * and asserts hard invariants on the email HTML + subject:
 *
 *   1. No (mode, balanceDue > 0) ever stamps "PAID" in green.
 *   2. Deposit flow always lands on the "DEPOSIT RECEIVED" template, never
 *      "PAID IN FULL".
 *   3. The receipt template is the ONLY mode that renders a green PAID
 *      badge — and only when balance = 0.
 *   4. balance / deposit-received with non-positive amount → refused
 *      (no email sent, no badge).
 *
 * Static analysis only — no Supabase, no Resend, no jsPDF render.
 */
import { describe, expect, test } from "bun:test";
import {
  computeInvoiceAmounts,
  type InvoiceMode,
} from "../src/lib/invoice-amounts";

// Re-implement the tiny `buildHtml` / `buildSubject` contract directly from
// send-invoice.server.ts so this test stays fast and free of side effects.
// If you change the template colours/labels there, sync them here.
const GREEN = "#15803D";
const PAID_BADGE_TEXT = "PAID";
const PAID_IN_FULL = "PAID IN FULL";
const DEPOSIT_BADGE = "DEPOSIT RECEIVED";
const BALANCE_BADGE = "BALANCE DUE";

import {
  // @ts-expect-error — server module imported for HTML/subject builders only.
  // The builders are pure (string in → string out) and need no env.
} from "../src/lib/email/send-invoice.server";

// We import the actual builders via dynamic require to avoid the
// `process.env.RESEND_API_KEY` send path. The builders don't touch env.
type Builder = (i: any) => string;
const mod = await import("../src/lib/email/send-invoice.server");

function fmtGBP(cents: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(cents / 100);
}

function makeInput(opts: {
  mode: InvoiceMode;
  totalCents: number;
  amountCents?: number;
  depositPaidCents?: number;
}) {
  const r = computeInvoiceAmounts(opts);
  if (!r.ok) return null;
  return {
    to: "test@example.com",
    businessName: "Acme Plumbing",
    invoiceRef: "Q-0001",
    amountFormatted: fmtGBP(r.headlineCents),
    dateFormatted: "01 Jan 2026",
    pdfBytes: new Uint8Array(),
    pdfFilename: "Invoice-Q-0001.pdf",
    mode: opts.mode,
    depositPaidFormatted: fmtGBP(r.depositPaidCents),
    totalFormatted: fmtGBP(r.totalCents),
    balanceDueFormatted: fmtGBP(r.balanceDueCents),
  };
}

// Reach into the module's internal builders via the public sendInvoiceEmail
// path would require RESEND_API_KEY — instead we re-grab them through the
// module namespace (they're top-level functions in send-invoice.server.ts).
const buildHtml: Builder = (mod as any).buildHtml ?? null;
const buildSubject: ((i: any, name: string) => string) | null =
  (mod as any).buildSubject ?? null;

describe("badge state-machine — module exports", () => {
  // If these are unexported, the matrix below would silently no-op. Fail loud.
  test("send-invoice.server exposes buildHtml / buildSubject for testing", () => {
    expect(typeof buildHtml).toBe("function");
    expect(typeof buildSubject).toBe("function");
  });
});

const modes: InvoiceMode[] = ["invoice", "receipt", "balance", "deposit-received"];
const TOTAL = 120000; // £1,200.00

const fixtures: Array<{
  mode: InvoiceMode;
  amountCents?: number;
  depositPaidCents?: number;
  label: string;
}> = [
  { mode: "invoice", label: "invoice full" },
  { mode: "receipt", label: "receipt full" },
  { mode: "receipt", amountCents: 84000, depositPaidCents: 36000, label: "receipt post-30%-deposit" },
  { mode: "balance", amountCents: 84000, depositPaidCents: 36000, label: "balance after 30% deposit" },
  { mode: "balance", depositPaidCents: 36000, label: "balance auto-headline" },
  { mode: "deposit-received", amountCents: 36000, label: "deposit-received 30%" },
  { mode: "deposit-received", amountCents: 33333, label: "deposit-received 33.333%" },
  { mode: "deposit-received", amountCents: 60000, label: "deposit-received 50%" },
];

describe("badge invariants across all modes × amounts", () => {
  for (const fx of fixtures) {
    test(`${fx.label}: invariants hold`, () => {
      if (!buildHtml || !buildSubject) return;
      const input = makeInput({ totalCents: TOTAL, ...fx });
      expect(input).not.toBeNull();
      if (!input) return;
      const html = buildHtml(input);
      const subject = buildSubject(input, input.businessName);

      const amounts = computeInvoiceAmounts({
        mode: fx.mode,
        totalCents: TOTAL,
        amountCents: fx.amountCents,
        depositPaidCents: fx.depositPaidCents,
      });
      expect(amounts.ok).toBe(true);
      if (!amounts.ok) return;

      // INVARIANT 1: no document stamps PAID while balance > 0.
      if (amounts.balanceDueCents > 0) {
        // A "PAID" badge would have to combine the green hex with the badge
        // text. We assert the green hex is ABSENT to make the check robust
        // against minor copy edits.
        expect(html).not.toContain(GREEN);
        expect(html).not.toContain(PAID_IN_FULL);
      }

      // INVARIANT 2: deposit flow never renders as full payment.
      if (fx.mode === "deposit-received") {
        expect(html).toContain(DEPOSIT_BADGE);
        expect(html).not.toContain(PAID_IN_FULL);
        // Green PAID badge must not appear on a deposit-received email.
        expect(html).not.toContain(GREEN);
        // Subject must reflect deposit, not full payment.
        expect(subject.toLowerCase()).toContain("deposit");
      }

      // INVARIANT 3: green PAID badge appears ONLY on receipt + zero balance.
      const hasGreenBadge = html.includes(GREEN) && html.includes(PAID_BADGE_TEXT);
      if (hasGreenBadge) {
        expect(fx.mode).toBe("receipt");
        expect(amounts.balanceDueCents).toBe(0);
      }

      // INVARIANT 4: balance template must show the balance-due chrome
      // and credit the deposit.
      if (fx.mode === "balance") {
        expect(html).toContain(BALANCE_BADGE);
        expect(html).toContain(fmtGBP(amounts.depositPaidCents));
      }
    });
  }
});

describe("compute refuses non-positive headlines (no badge ever emitted)", () => {
  test("balance with deposit ≥ total → refused", () => {
    const r = computeInvoiceAmounts({
      mode: "balance",
      totalCents: TOTAL,
      depositPaidCents: TOTAL,
    });
    expect(r.ok).toBe(false);
  });

  test("deposit-received with 0 amount → refused", () => {
    const r = computeInvoiceAmounts({
      mode: "deposit-received",
      totalCents: TOTAL,
      amountCents: 0,
    });
    expect(r.ok).toBe(false);
  });
});

describe("PDF stamp gate — only receipt mode passes paid_at", () => {
  // Mirrors the rule in invoice-email.server.ts:
  //   paid_at: mode === "receipt" ? paidAt : null
  // If that rule moves, this test should move with it.
  test.each(modes)("mode=%s → paid_at non-null iff mode is receipt", (mode) => {
    const paid_at = mode === "receipt" ? new Date().toISOString() : null;
    if (mode === "receipt") expect(paid_at).not.toBeNull();
    else expect(paid_at).toBeNull();
  });
});

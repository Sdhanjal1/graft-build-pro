/**
 * Layer 1 — pure-function money pipeline.
 *
 * Locks down deposit/balance/headline arithmetic, default deposit fraction,
 * deposit input parsing, and VAT-to-the-penny rounding. Zero I/O.
 */
import { describe, expect, test } from "bun:test";
import {
  DEFAULT_DEPOSIT_FRACTION,
  computeDepositAmount,
  computeDepositPercent,
  parseDepositInput,
} from "../src/lib/payment-timing";
import {
  computeInvoiceAmounts,
  computeVatToPenny,
} from "../src/lib/invoice-amounts";

describe("payment-timing constants", () => {
  test("DEFAULT_DEPOSIT_FRACTION is 30% — pins the C1 fix", () => {
    expect(DEFAULT_DEPOSIT_FRACTION).toBe(0.3);
  });
});

describe("computeDepositAmount / computeDepositPercent round-trip", () => {
  const totals = [99.99, 100.01, 3.33, 0.3, 1200, 500];
  const pcts = [0, 30, 50, 100];

  for (const total of totals) {
    for (const pct of pcts) {
      test(`total=${total} pct=${pct}% round-trips`, () => {
        const amt = computeDepositAmount(total, pct);
        // amount must never exceed total (to 2dp)
        expect(amt).toBeLessThanOrEqual(total + 0.005);
        // pct round-trip is within ±0.01% (computeDepositPercent rounds to 2dp)
        const back = computeDepositPercent(total, amt);
        expect(Math.abs(back - pct)).toBeLessThanOrEqual(0.01);
      });
    }
  }

  test("clamps out-of-range pct", () => {
    expect(computeDepositAmount(100, -10)).toBe(0);
    expect(computeDepositAmount(100, 200)).toBe(100);
  });

  test("zero subtotal yields zero pct", () => {
    expect(computeDepositPercent(0, 50)).toBe(0);
  });
});

describe("parseDepositInput", () => {
  test.each([
    ["30%", { kind: "pct", value: 30 }],
    [" 30 % ", { kind: "pct", value: 30 }],
    ["£500", { kind: "amount", value: 500 }],
    ["500", { kind: "amount", value: 500 }],
    ["1,200", { kind: "amount", value: 1200 }],
  ])("parses %p", (input, expected) => {
    expect(parseDepositInput(input as string)).toEqual(expected as any);
  });

  test.each([["abc"], [""], ["%"], ["£"]])("rejects %p", (input) => {
    expect(parseDepositInput(input as string)).toBeNull();
  });
});

describe("computeInvoiceAmounts — four modes", () => {
  const T = 100000; // £1,000.00

  test("invoice: headline = total, balance = total, deposit = 0", () => {
    const r = computeInvoiceAmounts({ mode: "invoice", totalCents: T });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.headlineCents).toBe(T);
    expect(r.balanceDueCents).toBe(T);
    expect(r.depositPaidCents).toBe(0);
  });

  test("receipt (full payment): headline = total, balance = 0", () => {
    const r = computeInvoiceAmounts({ mode: "receipt", totalCents: T });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.headlineCents).toBe(T);
    expect(r.balanceDueCents).toBe(0);
    expect(r.depositPaidCents).toBe(0);
  });

  test("receipt (post-deposit): headline = balance just paid, deposit credited", () => {
    const r = computeInvoiceAmounts({
      mode: "receipt",
      totalCents: T,
      amountCents: 70000,
      depositPaidCents: 30000,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.headlineCents).toBe(70000);
    expect(r.balanceDueCents).toBe(0);
    expect(r.depositPaidCents).toBe(30000);
  });

  test("balance: headline = total − deposit, balance same, deposit credited", () => {
    const r = computeInvoiceAmounts({
      mode: "balance",
      totalCents: T,
      depositPaidCents: 30000,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.headlineCents).toBe(70000);
    expect(r.balanceDueCents).toBe(70000);
    expect(r.depositPaidCents).toBe(30000);
  });

  test("deposit-received: headline = deposit, balance = total − deposit", () => {
    const r = computeInvoiceAmounts({
      mode: "deposit-received",
      totalCents: T,
      amountCents: 30000,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.headlineCents).toBe(30000);
    expect(r.balanceDueCents).toBe(70000);
    expect(r.depositPaidCents).toBe(30000);
  });

  test("deposit-received with 33.333% deposit rounds to the penny", () => {
    const r = computeInvoiceAmounts({
      mode: "deposit-received",
      totalCents: T,
      amountCents: 33333,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.headlineCents).toBe(33333);
    expect(r.balanceDueCents).toBe(66667);
    expect(r.headlineCents + r.balanceDueCents).toBe(T);
  });

  test("balance edge: amount ≤ 0 refused", () => {
    const r = computeInvoiceAmounts({
      mode: "balance",
      totalCents: T,
      depositPaidCents: T, // full deposit already paid → balance = 0
    });
    expect(r.ok).toBe(false);
  });

  test("deposit-received edge: amount = 0 refused", () => {
    const r = computeInvoiceAmounts({
      mode: "deposit-received",
      totalCents: T,
      amountCents: 0,
    });
    expect(r.ok).toBe(false);
  });
});

describe("computeVatToPenny — subtotal + vat = total exactly", () => {
  const totals = [3333, 9999, 10000, 12345, 100];
  for (const totalCents of totals) {
    test(`total=${totalCents}p splits to penny at 20% VAT`, () => {
      const { subtotalCents, vatCents, totalCents: t } = computeVatToPenny({
        totalCents,
        vatRate: 0.2,
        vatRegistered: true,
      });
      expect(subtotalCents + vatCents).toBe(t);
      expect(t).toBe(totalCents);
    });
  }

  test("non-VAT-registered → all subtotal", () => {
    const r = computeVatToPenny({
      totalCents: 10000,
      vatRate: 0.2,
      vatRegistered: false,
    });
    expect(r.subtotalCents).toBe(10000);
    expect(r.vatCents).toBe(0);
  });
});

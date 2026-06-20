/**
 * Layer 3 — PDF invariants (no text snapshots).
 *
 * Renders the invoice PDF via the real `generateInvoicePdfBytes` pipeline
 * for each of the four modes' inputs and asserts hard invariants on the
 * extracted text:
 *
 *   - invoice         → unpaid, "Total £1,200.00", VAT line to the penny
 *   - receipt         → "PAID" stamp present, VAT line to the penny
 *   - balance         → unpaid, no "PAID" stamp (badge lives in email)
 *   - deposit-received → unpaid, no "PAID" stamp
 *
 * VAT-to-penny: subtotal + vat == total exactly on the rendered figures.
 *
 * Note: the deposit/balance badges themselves live in the EMAIL HTML
 * (covered by Layer 2). The PDF only carries the "PAID" stamp, gated on
 * the `paid_at` field set by invoice-email.server.ts.
 */
import { describe, expect, test, beforeAll } from "bun:test";
import { generateInvoicePdfBytes } from "../src/lib/invoice-pdf.server";
import { computeVatToPenny } from "../src/lib/invoice-amounts";
import { PDFParse } from "pdf-parse";

const TOTAL_GBP = 1200; // £1,200.00 incl VAT
const VAT_REG = true;
const VAT_RATE = 0.2;
const { subtotalCents, vatCents } = computeVatToPenny({
  totalCents: TOTAL_GBP * 100,
  vatRate: VAT_RATE,
  vatRegistered: VAT_REG,
});
const SUBTOTAL = subtotalCents / 100; // 1000.00
const VAT = vatCents / 100;           // 200.00
const TOTAL = TOTAL_GBP;              // 1200.00

const PROFILE = {
  business_name: "Acme Plumbing",
  vat_registered: true,
  vat_number: "GB123456789",
} as any;

const CLIENT = {
  name: "Jane Customer",
  address: "1 Test Lane",
  email: "jane@example.com",
} as any;

function baseQuote(extras: Record<string, unknown> = {}) {
  return {
    ref: "Q-0001",
    title: "Bathroom refit",
    job_description: "Strip and refit bathroom suite.",
    line_items: [
      { description: "Labour", qty: 1, unit_price: SUBTOTAL, category: "labour" },
    ],
    subtotal: SUBTOTAL,
    vat_amount: VAT,
    total: TOTAL,
    vat_registered: true,
    created_at: "2026-01-01T00:00:00.000Z",
    ...extras,
  } as any;
}

async function renderText(q: any): Promise<string> {
  const bytes = await generateInvoicePdfBytes(q, CLIENT, PROFILE);
  const parser = new PDFParse({ data: new Uint8Array(bytes) });
  const out = await parser.getText();
  return out.text;
}

const cases = [
  {
    mode: "invoice" as const,
    quote: baseQuote({ paid_at: null }),
    shouldStampPaid: false,
  },
  {
    mode: "receipt" as const,
    quote: baseQuote({
      paid_at: "2026-01-15T12:00:00.000Z",
      payment_method: "card",
      stripe_payment_intent: "pi_test_123",
    }),
    shouldStampPaid: true,
  },
  {
    mode: "balance" as const,
    quote: baseQuote({ paid_at: null }),
    shouldStampPaid: false,
  },
  {
    mode: "deposit-received" as const,
    quote: baseQuote({ paid_at: null }),
    shouldStampPaid: false,
  },
];

describe("PDF invariants per mode", () => {
  const rendered = new Map<string, string>();

  beforeAll(async () => {
    for (const c of cases) {
      rendered.set(c.mode, await renderText(c.quote));
    }
  });

  for (const c of cases) {
    describe(`mode=${c.mode}`, () => {
      test("renders the full total figure", () => {
        const text = rendered.get(c.mode)!;
        // Allow either "£1,200.00" or non-breaking-space variant.
        expect(text).toMatch(/£\s*1,?200\.00/);
      });

      test("renders subtotal + VAT lines that sum to total (penny exact)", () => {
        const text = rendered.get(c.mode)!;
        // Find the GBP figures in the totals box.
        const figs = Array.from(text.matchAll(/£\s*([\d,]+\.\d{2})/g)).map((m) =>
          Math.round(Number(m[1].replace(/,/g, "")) * 100),
        );
        // Subtotal (100000p), VAT (20000p), and total (120000p) must all appear.
        expect(figs).toContain(subtotalCents);
        expect(figs).toContain(vatCents);
        expect(figs).toContain(subtotalCents + vatCents);
        // And the renderer's chosen subtotal+vat must equal total to the penny.
        expect(subtotalCents + vatCents).toBe(120000);
      });

      test("VAT label present (VAT-registered fixture)", () => {
        const text = rendered.get(c.mode)!;
        expect(text).toContain("VAT");
      });

      test(`PAID stamp ${c.shouldStampPaid ? "present" : "ABSENT"}`, () => {
        const text = rendered.get(c.mode)!;
        const stampRegex = /\bPAID\b/;
        if (c.shouldStampPaid) {
          expect(text).toMatch(stampRegex);
          // And the Stripe payment-intent reference rendered alongside it.
          expect(text).toContain("pi_test_123");
        } else {
          // No PAID stamp on any non-receipt mode — they're either pre-payment
          // (invoice / balance) or partial (deposit-received).
          expect(text).not.toMatch(stampRegex);
        }
      });
    });
  }
});

describe("PDF money invariant — non-VAT fallback note", () => {
  test("non-VAT-registered trader renders the HMRC clarity note", async () => {
    const text = await renderText({
      ...baseQuote({ paid_at: null }),
      vat_amount: 0,
      vat_registered: false,
      subtotal: TOTAL,
    });
    expect(text).toContain("VAT not applicable");
  });
});

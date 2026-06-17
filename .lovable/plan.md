## Restore accounting export across marketing site

Three surgical edits, copy/markup only, no logic changes.

### 1. `src/routes/index.tsx`
- Replace the existing `{/* ACCOUNTING / MTD */}` section (the one with the "Accounting, sorted" eyebrow, "Making Tax Digital ready." headline, and 4-card grid) with the new `{/* ACCOUNTING */}` section: lime-highlighted "Your books, already sorted." headline, accurate body copy (CSV export, VAT codes, no re-typing), and four pill-style platform tags (Xero, QuickBooks, FreeAgent, Sage).
- Position: between `{/* WHAT IT DOES */}` and `{/* FINAL CTA */}` (which is where the old MTD section already sits).
- Net effect: removes the "MTD ready / HMRC happy" overclaim.

### 2. `src/routes/features.tsx`
- Add a 7th item to the `features` array with `wide: true`:
  `{ kicker: "Accounting", title: "Your books, already sorted", body: "Export paid invoices as a CSV formatted for Xero, QuickBooks, FreeAgent or Sage, with the right VAT codes. No re-typing.", wide: true }`
- Update the cell className in the map to span all 3 columns when `f.wide`:
  `className={\`bg-ink p-8 ${f.wide ? "md:col-span-3" : ""}\`}`
- Result: 2 rows of 3 + a full-width accounting card.

### 3. `src/routes/pricing.tsx`
- Append `"Accounting export (Xero, QuickBooks, FreeAgent, Sage)"` to the `features` array (becomes 8 included items).

### Acceptance
- Home: new accounting section, no MTD/HMRC claims, four platform pills, no eyebrow pill, no icon-tiles.
- Features: 7th card spans full width on desktop.
- Pricing: accounting export listed.
- No em/en-dashes introduced.

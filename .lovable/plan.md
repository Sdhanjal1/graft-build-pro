## Findings

I scanned all in-app routes and shared components for stale large paddings, margins, gaps and stack spacing. After the previous two tightening passes the app is in good shape — only one real outlier remains, plus one small nit.

### 1. Public request form has excessive bottom padding (real issue)

`src/routes/request.$proId.tsx:141`

```tsx
<div className="min-h-screen bg-paper pb-32">
```

This page has **no sticky bottom bar** — the submit button is inline at the end of the form. `pb-32` (128px) leaves a large empty block under the CTA before the footer, mirroring the issue you just flagged on the new-quote page.

**Change:** `pb-32` → `pb-12`.

### 2. Invoice hero banner (intentional, leave alone)

`src/routes/invoices.$quoteId.tsx:86, 104` use `px-6 py-6` inside the dark "INVOICE" hero card. This is a deliberately weighty hero block (logo + huge amount due) — tightening it would weaken the visual hierarchy. **No change.**

### 3. Everything else

Headers, list rows, sticky CTAs, sheets, settings rows, chaser cards, clients pages, messages, quotes index, quote detail, onboarding, auth, forgot/reset password and the customer portal are all using the tightened values from the last pass. Marketing pages (`index.tsx`, `about.tsx`, `features.tsx`, `trades.*`, `faqs.tsx`, `privacy.tsx`, `terms.tsx`, `pricing.tsx`) intentionally keep generous `py-16`/`py-20`/`mt-12` spacing for landing-page rhythm — left alone, consistent with the previous pass.

## Plan

Single one-line edit:

- `src/routes/request.$proId.tsx` line 141: `pb-32` → `pb-12`.

No other files touched.
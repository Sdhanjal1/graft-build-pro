## Problem

On Settings, three things compete and the relationship is unclear:

1. **Accounting export setup** — a collapsed section header with a chevron (looks empty)
2. **Download for Xero** — primary CTA floating outside any card
3. **Export invoices** — secondary CTA floating below it

Result: the download buttons look orphaned, and the "setup" row looks like a dead link.

## Proposed redesign

Merge everything into **one single "Accounting export" card** that's open by default, with a clear top-to-bottom flow:

```text
┌─ Accounting export ──────────────────────────┐
│  Software:   [ Xero ▾ ]                      │
│  Account codes:  Set up ›   (inline summary) │
│                                              │
│  ─────────────────────────────────────────   │
│                                              │
│  [ ⬇  Download for Xero ]    ← primary       │
│  Paid invoices, one row per line item.       │
│                                              │
│  Download summary CSV instead ›  ← text link │
└──────────────────────────────────────────────┘
```

Key changes:
- **Remove the collapsible "Accounting export setup" wrapper.** Put the software picker + codes link directly in the card.
- **Promote "Download for [software]"** to the card's primary action, visually anchored inside the card so it clearly belongs.
- **Demote "Export invoices"** (the generic paid-quotes CSV) to a small secondary text link — most users won't need it once they've picked their software.
- **Move helper text under the button**, not above the section, so it explains the action you just looked at.
- **Show account codes status inline** (e.g. "4 of 5 codes set" or "Using defaults") so the user knows whether setup is needed without opening a separate panel.

If the user hasn't picked software yet, the card opens with a friendly empty state:
"Pick your accounting software to get a tailored export." with the dropdown front-and-centre.

## Files affected

- `src/routes/settings.tsx` — collapse the two sections (`Accounting export setup` + the bare export buttons block) into one `<Section>` rendered as a single card.
- `src/components/AccountingExportButton.tsx` — minor: accept a variant prop so it can render as the card's primary CTA rather than a standalone button-with-helper.
- The `AccountingSetup` component stays but gets simplified to live inside the same card (software dropdown + codes editor in a collapsible "Account codes" subsection).

No backend, schema, or export-logic changes — purely a layout/IA fix.

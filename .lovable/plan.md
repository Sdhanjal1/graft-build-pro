## Goal

In `src/routes/quotes.new.tsx`, change how generated and voice-added line items are merged so that:

1. Materials stay itemised; all labour collapses into one trailing "Labour" line.
2. Adding to an existing quote by voice appends new items instead of re-sending the existing quote to the AI (which currently re-itemises and duplicates).

No changes to the line-items editor UI, payment timing logic, initial voice flow, or anything outside this file.

## Changes

### 1. Add a labour-normalisation helper (top of `quotes.new.tsx`, file-local)

```ts
const LABOUR_HINT = /\b(labour|labor|fitting|installation|install|day rate|hr|hrs|hour|hours)\b/i;

function isLabourLine(li: LineItem): boolean {
  if (li.category === "labour" || li.category === "cis_labour") return true;
  if (li.category && li.category !== "other") return false; // materials/certificate stay non-labour
  return LABOUR_HINT.test(li.description ?? "");
}

function normalizeLineItems(items: LineItem[]): LineItem[] {
  const materials: LineItem[] = [];
  let labourTotal = 0;
  let sawLabour = false;
  for (const li of items) {
    if (isLabourLine(li)) {
      sawLabour = true;
      labourTotal += (li.qty || 0) * (li.unit_price || 0);
    } else {
      materials.push(li);
    }
  }
  if (!sawLabour) return materials;
  const labourLine: LineItem = {
    description: "Labour",
    qty: 1,
    unit_price: +labourTotal.toFixed(2),
    category: "labour",
    unit: "qty",
  };
  return [...materials, labourLine];
}

function normalizeDescriptionKey(s: string): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
```

### 2. Apply normalisation everywhere `setDraft` receives generated items

Wrap `g.line_items` (and equivalents) with `normalizeLineItems(...)` at these sites currently writing generated items into `draft` / `originalDraftRef`:

- line 320–321 (loading an existing quote — keep as-is; only normalise generator output, not user-saved data) → **leave unchanged** to preserve previously saved hand-edited quotes verbatim.
- line 913–916 (first build path) → normalise `built.line_items`.
- line 940–958 (merge path) → normalise the `merged.line_items`.
- line 980–981 (built path) → normalise `items`.
- line 1135–1137 (typed-text generate path) → normalise `g.line_items`.
- line 610–613 (current `applyVoiceEdit`) → replaced wholesale in step 3.

Both `setDraft({ line_items: normalized })` and `originalDraftRef.current = JSON.stringify(normalized)` use the SAME normalised array, so the dirty check stays consistent.

The manual line-items editor (lines ~1624–1717) is **not** wrapped — the user can freely add/edit/remove lines without auto-collapse mid-edit.

### 3. Rewrite `applyVoiceEdit` (lines 598–627) as additive-only

```ts
const applyVoiceEdit = async (transcript: string) => {
  if (!draft || !transcript.trim()) return;
  try {
    const g = await generateFn({ data: { description: transcript, trade, vatRegistered: vat } });
    const newItems = g.line_items ?? [];
    if (newItems.length) {
      // Existing materials kept verbatim; dedupe new materials by normalised description.
      const existing = draft.line_items;
      const existingMatKeys = new Set(
        existing.filter((li) => !isLabourLine(li)).map((li) => normalizeDescriptionKey(li.description))
      );
      const additions: LineItem[] = [];
      for (const li of newItems) {
        if (isLabourLine(li)) {
          additions.push(li); // folded into single Labour line by normalize
        } else if (!existingMatKeys.has(normalizeDescriptionKey(li.description))) {
          additions.push(li);
          existingMatKeys.add(normalizeDescriptionKey(li.description));
        }
      }
      const merged = normalizeLineItems([...existing, ...additions]);
      setDraft({ title: draft.title, line_items: merged });
      originalDraftRef.current = JSON.stringify(merged);
      if (!editId) paymentSeededRef.current = false;
      feedback("success");
      playSample("ding");
    }
    handleVoiceClose();
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Couldn't apply voice edit.";
    setVoiceError(msg);
    feedback("error");
  }
};
```

The old "EXISTING QUOTE … Re-output the FULL updated list" prompt is removed entirely.

## Worked example (verification)

1. Build "replace boiler £750 labour and boiler £1850" → AI returns boiler material + labour line → normalised draft = `[Boiler £1850, Labour £750]`.
2. Voice-add "replace toilet seat £20 and £30 labour" → AI returns `[Toilet seat £20, labour £30]` for the new transcript only → merged with existing, normalised = `[Boiler £1850, Toilet seat £20, Labour £780]`. No duplicate boiler; single labour line.

## Out of scope

- Manual editor behaviour, initial recording UI, payment timing, server functions, types in `user-data.ts`, any other file.

Three confirmations before you build:

1. Does the AI generator actually tag items with a `category` field (with "labour" as a value)? If yes, confirm detection uses it primarily and keyword-matching is only the fallback. If items have no category, flag that — detection will be keyword-only.
2. Confirm labour cost is stored as qty × unit_price for day-rate and hourly jobs (not a separate days field), so the labour sum is correct for those, not just flat amounts.
3. Confirm: voice-adding to an already-saved quote will collapse its existing labour lines into one combined line — I'm fine with that, just confirming it's intended.  
Apply once confirmed.
# Make voice "add items" additive only

Rewrite `applyVoiceEdit` in `src/routes/quotes.new.tsx` (lines 606–635) so a voice addition to an existing draft can only **append** new line items — it can never re-interpret, reorder, or re-price what's already on the quote.

## Behaviour change

Current behaviour: the function builds an "EXISTING QUOTE / CHANGE REQUEST" prompt that sends every existing line item to the model and asks it to re-output the full list. The model frequently rewrites or merges existing items.

New behaviour: treat the spoken transcript as a fresh mini-quote, then merge its items onto the end of the existing draft, with dedupe + deleted-item guards.

## New implementation of `applyVoiceEdit`

```ts
const applyVoiceEdit = async (transcript: string) => {
  if (!draft || !transcript.trim()) return;
  try {
    // Generate from the new transcript ALONE — same call shape as a fresh quote.
    const g = await generateFn({ data: { description: transcript, trade, vatRegistered: vat } });

    const existing = draft.line_items;
    const existingKeys = new Set(existing.map((li) => normDesc(li.description)));

    const newOnes = (g.line_items ?? []).filter((li) => {
      const key = normDesc(li.description);
      if (existingKeys.has(key)) return false;            // dedupe vs current draft
      if (deletedDescsRef.current.has(key)) return false; // respect user deletions
      return true;
    });

    if (newOnes.length) {
      const merged = [...existing, ...newOnes];
      setDraft({ title: draft.title, line_items: merged });
      originalDraftRef.current = JSON.stringify(merged);
      if (!editId) paymentSeededRef.current = false;
      feedback("success");
      playSample("ding");
    }
    handleVoiceClose();
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Could not apply voice edit.";
    setVoiceError(msg);
    feedback("error");
  }
};
```

## Notes / invariants preserved

- Title is never rewritten — kept as `draft.title`.
- `paymentSeededRef` reset only for fresh (non-edit) quotes, unchanged.
- `feedback("success")` + `playSample("ding")` fire only when at least one new item was actually appended; otherwise the overlay just closes silently (per spec, no "nothing new" toast).
- `originalDraftRef.current` is updated only when the draft changes, keeping dirty-tracking consistent.
- `try/catch` error handling (`setVoiceError` + `feedback("error")`) is unchanged.
- No changes to existing items: no reordering, no re-pricing, no re-itemising.
- The `editPrompt` string and the `existingItems` mapping are removed (no longer used).
- No other call sites of `applyVoiceEdit` change — it is still invoked from line 529 with the combined description.

## Out of scope

Nothing else in the file is touched: `runTranscribe`, `finaliseFromAudio`, `regenerateLiveQuote`, the typed-desc flow, and the patch/edit pipeline (`editedItemsRef`/`deletedDescsRef` writes at lines 1219–1236) all stay as they are.

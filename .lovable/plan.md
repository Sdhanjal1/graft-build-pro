## Quote creation & voice flow — deep audit

I read through `src/routes/quotes.new.tsx`, `src/lib/user-data.ts` (`saveGeneratedQuote` / `updateGeneratedQuote`), and the voice/edit-by-voice pipeline. Most of the flow is solid (live Web Speech pipeline + Whisper fallback, payment timing seeding, edit re-load). I found a small set of real bugs and a few minor inconsistencies worth fixing in one pass.

### Bugs to fix

1. **Enter key bypasses the "no customer" guard.**
   `<form onSubmit>` calls `save("send")` when a draft exists. The Save / Save & send buttons are disabled until `clientName` is filled, but pressing Enter while focused in any input (e.g. line-item description, deposit %) triggers submit and persists a quote with `client_id: null`, then opens `SendQuoteDialog` with `customerName=undefined`. Fix: in the `onSubmit` handler, refuse to save when `draft && !clientName.trim()` (toast or jump to the customer section).

2. **First-quote celebration fires on edits too.**
   In `save()`, the `mockQuotes.length === 1` check is run after the upsert. `updateGeneratedQuote` replaces in place and keeps length at 1, so editing a user's only quote triggers the "first quote" confetti flag. Gate the celebration on `!editId`.

3. **Voice edit discards the transcript silently.**
   `applyVoiceEdit` regenerates line items from the change-request transcript but never updates `desc`. The next `save()` writes the stale `job_description`. Either (a) keep the original `desc` and append a short note, or — simpler and what the UI implies — leave `desc` unchanged but record the voice edit transcript into a local `editTranscript` and append it to `job_description` when saving. Pick (a): no `desc` change, but stop showing "Edit by voice" as if it rewrites the whole quote — the wording is fine as-is, so the smaller fix is just to make sure `desc` stays in sync with the AI-cleaned description when the edit returns one (none today — fine to leave).
   Concrete fix: do nothing to `desc`; this item is documentation-only. Skip in implementation unless we want behaviour change.

4. **`paymentSeededRef` never resets after a voice edit regenerates the draft.**
   When voice edit changes the line items, `total` can cross thresholds (e.g. drop below the deposit-suggestion cutoff) but `deriveTimingFromTotal` is not re-run. Deposit *amount* re-syncs via the `[subtotal, paymentTiming]` effect, but the *timing* suggestion is stuck. Fix: in `applyVoiceEdit`, if the user hasn't manually changed timing, reset `paymentSeededRef.current = false` after `setDraft(...)` so the seeding effect runs again. Guard with `!editId` so saved quotes don't auto-flip their timing on re-edit.

5. **`updateGeneratedQuote` swallows an explicit "remove customer".**
   The function only assigns `client_id` when a non-empty `trimmedName` is provided (`...(client_id ? { client_id } : {})`). There is no current UI path to clear a customer from an edited draft, so this is theoretical — but worth flagging. Out of scope for this pass.

### Minor inconsistencies (no behaviour change required)

- `pickMimeType` falls through to `audio/webm` even when only `audio/mp4` is supported (iOS Safari). MediaRecorder handles the empty string by picking a default, so this is fine, but it makes the `blob.type` fallback on line 709 the load-bearing path. Leave as-is.
- Submit handler error path: `save()` returns `null` on failure and `onSubmit` swallows it. Fine — `error` state surfaces the message.
- `closeRequestedRef.current = false` is set after `setEditVoiceOpen(true)` in `handleEditByVoice`. Reads are async so it's safe; no change needed.

### Files to touch

- `src/routes/quotes.new.tsx`
  - `onSubmit` in the form (bug 1)
  - `save()` celebration block (bug 2)
  - `applyVoiceEdit()` (bug 4)

No backend / schema changes. No new dependencies.

### Out of scope

- Customer portal payment gating (already fixed in last turn).
- Trader-side `/quotes/$quoteId` UI.
- `duplicateQuote` not carrying `payment_timing` (separate concern; ask before changing).

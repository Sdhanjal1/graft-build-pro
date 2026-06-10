# Voice-to-Quote Audit & Fix Plan

A read-only audit of `src/routes/quotes.new.tsx` and supporting files (`ai-quote.functions.ts`, `transcribe.functions.ts`, `RotatingPrompts`, `RotatingStatus`, `useSubscription`, `IOSStandaloneRecordingNotice`) surfaced 29 issues. This plan fixes the ones that actually affect users. No new features.

## Critical — fix these or recording can hang / duplicate work

1. **Infinite wait when a phrase-generate hangs** (`quotes.new.tsx` ~192) — `waitForPendingPhraseProcessing` busy-spins with no timeout, so a stuck server call leaves the overlay locked on "Building your quote…" forever. Add a 30 s wall-clock bail-out and proceed with whatever live items exist.
2. **"Building" state never clears on early-stop race** (`quotes.new.tsx` ~355) — `stopRecording` sets `building=true` then returns early if `mediaRecorderRef` isn't ready, leaving the UI stuck. Move `setBuilding(true)` into `mr.onstop`, or reset on the early-return.
3. **Duplicate line items when live + fallback both succeed** (`quotes.new.tsx` ~647) — if the debounced `regenerateLiveQuote` is still in flight when `onstop` runs, `liveItemsRef` is empty so `runTranscribe` also fires; both eventually produce line items. Track the in-flight regen promise and await it before the empty-check.
4. **Mic stays live after navigating away mid-recording** (`quotes.new.tsx` ~201) — unmount cleanup stops `streamRef` but not `sharedStreamRef`, in-flight recognition, or debounced regen. Stop both stream refs, abort recognition, clear the debounce timer, and bump `voiceSessionRef` to orphan in-flight generates.

## High — fix these for UX correctness

5. **Trial-blocked users hit a generic error after recording** (`quotes.new.tsx` ~404) — `runTranscribe` calls `generate` without the `subBlocked` guard, so the server rejects and the message lands in `voiceError` (which may already be dismissed). Guard early with a clear "Trial ended — add a payment method" message and surface it on the main form too.
6. **Session-ID race in `startRecording`** (`quotes.new.tsx` ~543) — `sessionId` is captured before `getUserMedia` resolves; a Close tap during that await can desync guards. Snapshot `sessionId` after `getUserMedia` succeeds.
7. **iOS Safari mimeType mismatch** (`quotes.new.tsx` ~46, ~615) — when the constructor fallback is used, `mr.mimeType` can be empty and the stored `pickMimeType()` value may not match the actual blob encoding, producing garbled Whisper transcripts. Read `mr.mimeType` once `ondataavailable` first fires and use that for upload.
8. **Web Speech result-index reset duplicates phrases on auto-restart** (`quotes.new.tsx` ~714) — resetting `lastFinalIdxRef` to -1 on `onend` can re-emit buffered phrases. Track a cumulative offset across restarts instead.
9. **`MicLevelRings` analyser stuck on a stale stream** (`quotes.new.tsx` ~1586) — effect depends on the ref object, not `streamRef.current`, so swapping streams between recordings keeps the analyser pointed at the old one. Pass the `MediaStream` directly or extract `.current` outside the dep array.

## Medium — code-quality & smaller UX wins

10. Remove dead `processPhrase` + `processedPhraseKeysRef` (~451) — superseded by `regenerateLiveQuote`; keeping it is a maintenance trap.
11. Pass `prefetchedContextRef.current` in the manual-text `generate()` path too (~786) — voice path already does this; saves an extra DB round-trip.
12. Surface a "loading" state from `useSubscription` so the Generate button doesn't briefly say "Trial ended" during initial fetch (~hooks/useSubscription).
13. Initialise `editLoading` lazily so cached quotes don't flicker through a loading state (~265).
14. Fix the leaked inner `setTimeout` in `RotatingPrompts` — capture and clear it in the effect cleanup (~components/RotatingPrompts).
15. Drop the duplicate `navigate` in `handleVoiceClose` (~334) — `handleVoiceStart` already clears `?voice=1`.
16. Use stable IDs (not array index) as React keys for `draft.line_items` (~1100) and `liveItems` (~1838) so deletes/reorders don't shuffle focus and animation state.
17. Merge `voiceError` into the main `error` channel when `runTranscribe` fails after the overlay has been closed, so the failure isn't silently lost (~409).

## Low — accessibility & polish

18. `desc` textarea: associate the helper text via `aria-describedby` (~1014).
19. `RotatingStatus`: change `aria-live="polite"` to `"off"` and put a single descriptive label on the parent button — currently announces every 1.5 s tick (~components/RotatingStatus).
20. Customer phone input: add `id` + `htmlFor` so screen readers announce the label (~1322).
21. Verify the `safe-bottom` utility resolves to `env(safe-area-inset-bottom)`; if not, the floating Generate button and overlay FAB can clip behind the iPhone home indicator (~1051, ~2005).
22. `blobToBase64`: replace `String.fromCharCode.apply` chunk loop with `FileReader.readAsDataURL` to avoid a `RangeError` on long recordings (~63).
23. Reset `lastFinalIdxRef` in `handleVoiceClose` for completeness (~320).
24. Use a stable channel suffix in `useSubscription` instead of `Math.random()` to avoid churn under StrictMode (~hooks/useSubscription).

## Out of scope

- No new features (e.g. no edit-per-unit UI for the overlay price field, even though L-10 flagged a confusing UX).
- No backend/SQL changes.
- No visual redesign of the overlay.

## Suggested execution order

Critical → High → Medium → Low. Items are independent enough to land in one pass, but I'd verify each Critical fix in the preview (start/stop/cancel cycle, slow-network simulation) before moving on.

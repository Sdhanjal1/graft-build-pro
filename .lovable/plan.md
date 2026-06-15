# Remove dead live-preview pipeline

Pure deletion. `finaliseFromAudio`, the `MediaRecorder` flow, `applyVoiceEdit`, and the `draft` / `!draft` split are untouched.

## ⚠️ Heads-up: existing invariant test will break

`tests/voice-overlay-transcript-invariant.test.ts` currently asserts that `setLivePreview(`, `liveFinalRef.current =`, and `liveInterimRef.current =` still exist in `src/routes/quotes.new.tsx`. After this deletion, those identifiers are gone and that test fails.

Since the whole point of Prompt B is that the live capture is dead code, the test is also obsolete. Plan: delete `tests/voice-overlay-transcript-invariant.test.ts` as part of this change. Flagging explicitly so it isn't a surprise.

## src/routes/quotes.new.tsx

1. **Speech Recognition setup inside `startRecording**` (~lines 896–945): delete the entire `SR = window.SpeechRecognition || …` block, `rec.onresult` / `rec.onerror` / `rec.onend`, `rec.start()`, both `setLiveSupported` calls, and the surrounding `try { … } catch { setLiveSupported(false) }`. Keep `MediaRecorder` setup, `mr.start(1000)`, the seconds tick interval, and the `finaliseFromAudio` call on stop unchanged.
2. `**regenerateLiveQuote**` (~lines 670–762): delete the function and the debounce scheduler that calls it.
3. **State / refs / helpers** — delete every declaration and every read/write of:
  `liveItems`, `setLiveItems`, `liveItemsRef`, `pendingItems`, `setPendingItems`, `pendingItemsRef`, `clearPendingItems`, `pendingCountRef`, `livePreview`, `setLivePreview`, `liveFinalRef`, `liveInterimRef`, `liveDebounceRef`, `phraseSeqRef`, `lastFinalIdxRef`, `speechIndexOffsetRef`, `recognitionRef`, `liveSupported`, `setLiveSupported`, `building`, `setBuilding`, plus `prefetchFn` / `useServerFn(prefetchQuoteContext)` (line 155) and the `prefetchQuoteContext` import (line 25).
   This includes all the teardown lines that currently clear these inside `finaliseFromAudio`, `handleVoiceClose`, `stopRecording`, and the unmount cleanup effect (~lines 260–262, 401–402, 421–422, 434–436, 448, 454–462, 522, 552–553, 586–590, 775–781, 828–829, 852–853, 877, 881, 884–885). After removal those cleanup blocks may collapse to no-ops — drop them if empty.
4. **VoiceOverlay call site** (~lines 1197–1245): remove `liveItems`, `pendingItems`, `transcript`, `building`, `onUpdateItem`, `onDeleteItem` props (and the inline handlers at 1234/1243 that mutate `liveItemsRef`). Keep `recording`, `transcribing`, `seconds`, `error`, `lastTranscript`, `streamRef`, `onStart`, `onStop`, `onClose`, `onTypeInstead`, `onRetryTranscription`.
5. `**VoiceOverlay` signature + type** (~lines 2285–2333): remove the same six props from the destructure and the type. Drop the `void liveItems; void pendingItems;` discards and the `isBuilding = transcribing || building` line (replace usages with just `transcribing`).

## src/lib/ai-quote.functions.ts

6. Delete `prefetchQuoteContext` (lines 399–418) and its doc comment.
7. In `InputSchema`: drop `previousChunkText`, `previousItemDescription`, `prefetchedContext` (lines 24–37 / 27–37) and the `PatternSchema` if it's only used by `prefetchedContext` (it is — also delete lines 9–18).
8. In the handler: drop the `if (data.prefetchedContext) { … } else { … }` branch and keep only the `else` body (always fetch patterns + rates from DB).
9. In the prompt: remove `prevBlock`, the `${prevBlock}` interpolation, the entire "ITEM BOUNDARY DETECTION (LIVE PHRASE CAPTURE)" section of `SYSTEM_PROMPT` (lines 226–250), the `continues_previous` field on `QuoteSchema` (lines 60–65), and the `"continues_previous": false,` line in the example JSON.

## Verification

After edits, grep the file for every removed symbol — must return zero matches in `src/routes/quotes.new.tsx` and `src/lib/ai-quote.functions.ts`:

```
liveItems liveItemsRef pendingItems pendingItemsRef clearPendingItems pendingCountRef
livePreview setLivePreview liveFinalRef liveInterimRef liveDebounceRef
phraseSeqRef lastFinalIdxRef speechIndexOffsetRef recognitionRef
liveSupported setLiveSupported regenerateLiveQuote prefetchQuoteContext
setBuilding building SpeechRecognition webkitSpeechRecognition
previousChunkText previousItemDescription prefetchedContext continues_previous
```

Then let the typechecker run.

Notes - 1. The building → transcribing swap in VoiceOverlay (step 5). Make sure the building skeleton state you just added in Prompt A is driven by transcribing after this. Prompt A’s skeleton showed on transcribing || building; once building is gone, it must show on transcribing alone. The plan says to replace usages with transcribing — just confirm the skeleton still actually appears, because that’s the wow moment you don’t want to accidentally gate off.

2. stopRequestedRef. The Web Speech onend handler referenced stopRequestedRef (line 933). Check whether stopRequestedRef is used anywhere else — if it was only there for the Web Speech restart logic, it’s now dead too and can go; if stopRecording uses it, leave it. The plan doesn’t mention it, so worth a quick grep so you don’t leave one orphan ref.
## Voice-to-quote — issues found and proposed fixes

The flow is well thought through (per-phrase regenerate, append-only tile merge, append-only background reconcile, Whisper fallback when Web Speech is unavailable). But there are five real bugs and three UX gaps that will bite real users. Ordered by severity.

---

### P0 — silent failures that look like "broken"

**1. Per-phrase `generateFn` failures are swallowed.**
`regenerateLiveQuote` wraps the AI call in `try/catch { console.warn(...) }`. If Anthropic returns 401/429/500, or the user is rate-limited, the user keeps talking, no tiles appear, and there's no error on the overlay. Combined with the Whisper fallback only firing when `liveItemsRef.current.length === 0`, a partial failure mid-recording is invisible.

Fix: track a consecutive-failure counter inside the session. After 2 consecutive failures, surface a `voiceError` on the overlay ("Quottr couldn't reach the AI — stop and try again, or type the job") without stopping the recorder. Reset the counter on first success.

**2. Subscription gate runs too late.**
`subBlocked` is only checked inside `runTranscribe`, after a Whisper call has already gone out. A user on day 15 with no card can record a 60-second clip, hit stop, wait for transcription, then see "Trial ended". Worse: per-phrase `generateFn` calls during recording will all reject server-side (`requireActiveSubscription`), invisibly (see #1).

Fix: gate at `handleVoiceStart` / `handleEditByVoice` — if `subBlocked`, do not call `getUserMedia` at all, show the "Trial ended — add payment method" CTA in the overlay's error slot (re-uses the existing error UI), wire the button to open the billing portal.

**3. Race on close orphans aren't complete — Whisper results can still mutate the form.**
`handleVoiceClose` bumps `voiceSessionRef.current` and sets `closeRequestedRef.current = true`, but `runTranscribe` and `appendTranscript` do not check either before calling `setDesc(combinedDesc)` or auto-running `generate(combinedDesc)`. A user who taps Cancel while transcription is in flight can have the textarea silently overwritten ~2s later and an unwanted full quote generated.

Fix: at the top of `runTranscribe`'s post-`await` continuation, bail out if `closeRequestedRef.current || sessionId !== voiceSessionRef.current`. Pass `sessionId` into `runTranscribe` so it captures the session at call time.

---

### P1 — recoverable-vs-unrecoverable confusion

**4. SpeechRecognition `onerror` is fully silenced.**
`rec.onerror = () => { /* silent: pipeline only */ }`. Two of the four event types are unrecoverable: `not-allowed` and `service-not-allowed` (Chrome killed the recognition session, often when mic permission was revoked or when on insecure context). `onend` then immediately restarts via `rec.start()` and instantly errors again, looping. The user sees no tiles, no error, and the FAB still says "Listening…".

Fix: differentiate. Log every error. On `not-allowed` / `service-not-allowed` / `audio-capture`: stop trying to restart in `onend`, set `voiceError`, and keep MediaRecorder running so the Whisper fallback at stop still produces tiles. On `no-speech` and `aborted`: keep current behaviour.

**5. No timeout on `getUserMedia` or per-phrase `generateFn`.**

- `navigator.mediaDevices.getUserMedia` can hang indefinitely on locked-down browsers (corporate MDM, certain in-app webviews). The user sees `voiceOpening = true` forever with no escape.
- `generateFn` per-phrase has no `AbortSignal.timeout(...)`; a stalled Anthropic call leaves `building = true` and `pendingCountRef > 0`, which makes the post-stop `waitForPendingPhraseProcessing` block up to 30s.

Fix: `Promise.race(getUserMedia, timeout(10_000))` with a plain-English error on timeout. Wrap per-phrase `generateFn` in `AbortSignal.timeout(20_000)` and treat timeouts as failures for #1's counter.

---

### P2 — small UX gaps

**6. iOS has no SpeechRecognition.** The live tiles experience is exclusively the Whisper-only fallback path. This works, but there's no signal during recording that anything is being captured beyond the level meter. Acceptable for launch; flag for follow-up (would need a streaming STT, e.g. ElevenLabs realtime — the connector is already linked).

**7. "Could not start recorder on this browser."** Still in tech-y voice — replace with the same plain-English style we used for #15. E.g. "This browser can't record audio — open Quottr in Safari or Chrome." Same for "Microphone not supported on this device."

**8. `speechIndexOffsetRef` is dead code.** Declared and reset on start, never read. Either wire it up to track cumulative final indices across SR auto-restarts (currently relies on `lastFinalIdxRef = -1` reset in `onend`, which is correct but undocumented) or remove the ref. Recommend remove + a short comment on the existing approach.

---

### Scope I'm proposing

If you're happy, I'd ship #1, #2, #3, #4, #5 together — they're all in the same file (`src/routes/quotes.new.tsx`) and the same mental model (session-scoped error handling + cancellation hygiene). #7 is a one-line tweak. #6/#8 deferred.

If you only want one: **#3 (close-race)** is the one most likely to cause a "WTF, who edited my quote" support ticket. **#1 (silent failures)** is the one that quietly destroys trial-to-paid conversion when the AI hiccups.

Here’s the note to add to the plan for approval:

Approved — ship #1, #2, #3, #4, #5, and #7 together as one batch. Defer #6 and #8. Three additions/clarifications before you build:

On #1 (surface failures): make the surfaced error specific, not generic. Distinguish the failure reason and show plain-English text accordingly:

	•	Auth/401 → “Couldn’t reach Quottr’s AI — please refresh and sign in again.”

	•	Rate limit/429 → “Too many requests just now — wait a few seconds and keep talking.”

	•	Subscription rejection/403 → the trial/billing CTA (ties to #2).

	•	Network/timeout/500 → “Couldn’t reach the AI — check your signal, or type the job instead.”

Also log the actual error (status + short body) to the console for every failure, even the ones that don’t surface yet, so I can diagnose the real cause when testing. The consecutive-failure counter and “surface after 2, reset on success, don’t stop the recorder” behaviour is correct as you described.

On #2 (subscription gate): gate at handleVoiceStart / handleEditByVoice before getUserMedia — if subBlocked, don’t request the mic at all; show the “Trial ended — add payment method” CTA in the overlay’s error slot, wired to the billing portal. Important: confirm that trial users (trialing status) and past_due are NOT blocked — only genuinely lapsed/cancelled subs should be gated. Trial users must be able to use voice fully; that’s when they evaluate it. If subBlocked currently includes trialing, fix that as part of this.

On #3 (close-race): pass sessionId into runTranscribe (captured at call time) and bail at the top of every post-await continuation if closeRequestedRef.current || sessionId !== voiceSessionRef.current, before any setDesc / setDraft / auto-generate. Apply the same guard in appendTranscript.

General: this is all in src/routes/[quotes.new](http://quotes.new).tsx. Don’t change the voice architecture, the per-phrase pipeline, or the tile-merge logic — these are error-handling, cancellation, and gating fixes only. After building, confirm the five fixes don’t alter the happy-path flow (record → tiles → stop → quote) at all.

&nbsp;
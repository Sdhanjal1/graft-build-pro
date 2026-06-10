# Simplify /quotes/new — remove the duplicate Voice tile

## The problem

`/quotes/new` (when no draft exists) currently shows two primary-looking surfaces stacked vertically:

1. A card with a **Voice to text** pill + rotating example prompts. Tapping it records, transcribes (Whisper), and dumps the text into a `desc` textarea below.
2. A floating **Generate quote** button pinned above the bottom nav. Tapping it sends `desc` to the AI.

Two issues:
- They look like competing CTAs but they're sequential steps — record first, then generate.
- The full-screen voice overlay (`?voice=1`, opened by the floating mic on other pages) already does record → transcribe → generate in one motion. The inline tile is the slower, two-tap version of the same thing.

## The fix

Make the page have **one** primary action and a clear secondary entry for voice.

### New layout (no draft state)

- Remove the inline "Voice to text" card entirely (the pill, rotating prompts, voice error, and the iOS standalone notice tied to it).
- Replace it with a single text area card titled "Describe the job" (always visible, not gated on `desc` being non-empty), with the rotating example prompts shown as placeholder/helper text when empty.
- Keep the floating **Generate quote** button at the bottom (unchanged behaviour: sends `desc` to AI).
- Add a secondary **"Or speak it instead"** link/button directly under the textarea that navigates to `?voice=1` — reusing the existing full-screen voice overlay which already handles record → transcribe → generate end-to-end.

This removes the redundancy: typing path uses the textarea + Generate; voice path uses the overlay (one tap, one flow). No more half-voice / half-type middle state on the main page.

### Files touched

- `src/routes/quotes.new.tsx` — delete the `!draft` "card-surface" block that renders the inline Voice button, `RotatingPrompts`, `IOSStandaloneRecordingNotice`, `voiceError`, and the conditional `desc` textarea. Replace with a single always-visible textarea card + "Or speak it instead" link that calls `handleVoiceStart()` (already defined).
- Keep `toggleRecord`, `startRecording`, `stopRecording`, and related inline recording state in place for now — they're still used by the overlay path's plumbing. (If audit confirms they're truly dead after removal, a follow-up can delete them; out of scope here.)

### Out of scope

- No changes to the voice overlay itself.
- No changes to the Generate flow, AI prompt, or backend.
- No changes to the draft/preview state below.
- No visual redesign beyond the consolidation described.

## Acceptance

- `/quotes/new` shows: header → "Describe the job" textarea (with rotating placeholder when empty) → "Or speak it instead" link → floating Generate button.
- Typing + tapping Generate works as today.
- Tapping "Or speak it instead" opens the existing full-screen voice overlay and the existing record → auto-generate path completes a quote.
- No second "Voice to text" pill on the page.

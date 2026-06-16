## Goal

For the main voice flow on `src/routes/quotes.new.tsx`, the entire experience happens on the quote screen itself. Tapping the mic immediately starts the live session, tiles appear in place as the user speaks, and a stop control on the screen finalises. The full-screen `VoiceOverlay` is never used for `recordTarget === "desc"`. Clip mode (`"clip"`) and edit-by-voice (`"edit"`) keep `VoiceOverlay` exactly as today.

## Changes (all in `src/routes/quotes.new.tsx` — no hook changes)

### 1. Overlay only mounts for clip / edit

Today (line 1016):

```tsx
{(editVoiceOpen || !draft) && (recording || transcribing || voicePending || voiceError || voiceOpening) && !(liveActive && draft && !voiceError) && (
  <VoiceOverlay ... />
)}
```

Replace the gate so it only mounts when the recording target is `"clip"` or `"edit"` (i.e. `editVoiceOpen` is true, or a clip recording is in flight). The desc branch is removed from this condition entirely. Net effect: tapping the main mic never shows `VoiceOverlay`.

Because we no longer rely on the overlay to surface `voiceOpening` / mint / SDP errors for the desc flow, those are surfaced inline instead (see step 4).

### 2. `LiveRecordingBar` shows for the whole desc session

Today the compact bar only mounts once `draft` exists (line 1043). Change the gate so it mounts as soon as a desc-target session is active — i.e. whenever `liveActiveRef`'s mirror is true and there's no `voiceError`. The bar already shows the lime pulse, mic-level bars, timer, and a square stop button, so this is the single on-screen control for the whole live flow (including the pre-first-tile window).

Keep the existing portal + `bottom-nav` placement so it sits above the keyboard / nav and doesn't shift quote content.

### 3. Inline "listening…" placeholder before the first tile

While `liveActive && !draft && !voiceError`, render a small placeholder inside the existing `!draft` block (or replacing it for live desc sessions) so the surface isn't the unchanged empty hero. Minimal: a single muted "Listening — start describing the job…" line with a subtle pulse, sitting where the tiles will appear. No animation polish; this is the empty state of the live surface, not a new design.

The existing hero entry buttons (`Speak the job`, `Or type it instead`, typing textarea, RotatingPrompts) are hidden while `liveActive` is true so the surface is clean for incoming tiles.

### 4. Inline error + opening states for desc

- `voiceOpening` (mic permission / token mint in flight, before `liveActiveRef` flips true): show a tiny inline status next to or in place of the mic CTA — e.g. spinner + "Starting mic…". No overlay.
- `voiceError` during a desc session: render an inline error card above the (still-mounted) hero CTAs with a Retry that re-runs `handleVoiceStart`. Tear down the bar (already handled because `liveActive` flips false on stop/error).

### 5. Stop button parity

The square button in `LiveRecordingBar` already calls `stopRecording`, which triggers the live hook's final regenerate via the existing `liveActiveRef` branch. No changes to `stopRecording`, `finaliseLiveSession`, or `use-live-quote-session.ts`.

### 6. Out of scope

- `src/lib/use-live-quote-session.ts` — untouched.
- `VoiceOverlay` component — untouched; still used by clip + edit.
- `src/routes/dev-token-test.tsx` harness — untouched.
- No visual redesign of the bar / tiles / hero beyond the gating + tiny inline placeholder.

## Acceptance

- Tap main mic on `/quotes/new` → no full-screen overlay appears at any point. The screen stays put; a compact bar appears at the bottom with timer + mic bars + stop, and a small "listening…" placeholder sits where tiles will land.
- Speaking produces tiles inline; stop finalises in place and the bar disappears.
- Mic-permission denial / token failure shows an inline error on the quote screen with a retry, never a full-screen overlay.
- Clip recording (camera/clip entry) and edit-by-voice still open `VoiceOverlay` exactly as before.

This plan is right. It does exactly what you described — one screen, tiles load in front of you, stop finalises, no overlay for the main flow. Approve it. Five points worth confirming before they build, so it’s right the first time and you’re not back here:

1. The empty/listening state must not look broken. Step 3 deliberately keeps it minimal (“not a new design”). That’s fine for function, but the first thing the user sees when they tap mic is now this bare “Listening…” line — if it looks empty or unfinished, the whole feature feels cheap. I’m OK with it being minimal for this build as long as it’s clearly intentional (centred, a clear pulse, obviously “I’m listening for you”), not just a stray line of muted text. Tell them: minimal is fine, half-built-looking is not. Polish comes in 4c, but it can’t look broken now.

2. Hiding the hero CTAs while live (step 3) — confirm the “type instead” escape still exists. They’re hiding “Speak the job / type it instead / textarea” during a live session. Good for a clean surface — but if the mic fails or the user wants to bail to typing mid-session, there must still be a way to. Step 4’s inline error has a Retry, but confirm there’s also a path back to typing if voice just isn’t working. Don’t strand the user in a voice-only state with no exit.

3. Stop button must be unmissable. Step 2 makes LiveRecordingBar the single control for the whole session, including before the first tile. That’s correct — but it means the square stop button is now the only way to end recording, and it’s a compact bar at the bottom. Confirm it’s clearly tappable as “stop/finish” from the very first second, not something that reads as a status indicator. This is the one control the entire flow depends on.

4. What if they tap mic and say nothing / it mishears everything? With the overlay gone, the old “We didn’t catch any speech” guard lived in the overlay/finalise path. Confirm that an empty or failed live session still gives the user clear feedback (“didn’t catch that, try again”) inline, rather than just sitting on the “Listening…” placeholder forever or finalising into an empty quote.

5. This is the right moment to ask: does the bar’s stop reliably finalise? Step 5 says the square calls stopRecording → final regenerate via existing branch, untouched. That path was working in 4a. Just confirm it still fires now that the bar is the sole trigger and mounts earlier — the earlier mount is the only behavioural change and you don’t want the stop wired to a bar state that’s now different.

None of these change the plan’s shape — they’re guardrails on the seams where removing the overlay could drop a behaviour the overlay used to carry (errors, the empty-speech guard, the typing escape, the stop control’s prominence). Send those five as confirmations and let them build.

Then test the one flow, on the real screen: tap mic → clean “listening” → speak → tiles load in front of you → tap stop → finished quote, all on one screen, no overlay. That’s the whole acceptance test. If it does that, you’re done with the hard part and we’re into polish and the fallback.
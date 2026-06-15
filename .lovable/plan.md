# Voice overlay: "wow" recording + building state

Scope is limited to the `VoiceOverlay` component in `src/routes/quotes.new.tsx` (lines ~2285–2700). The call site, props, `finaliseFromAudio`, the recording pipeline, the live-pipeline state machinery, the `draft`/`!draft` screen split, and the error/typed-instead flows are all left untouched.

## What changes inside VoiceOverlay

### 1. Drop the list rendering

Delete:

- The `showList` block — the scrollable `<ul>` of `liveItems`, the `pendingItems` rows, the `building` placeholder row inside it, the top/bottom fades, the "What you said" transcript `<details>`.
- The pinned-top **Running total** + `CountUpGBP` and the "Tap a line to edit" hint.
- The smaller "ACTIVE / BUILDING STATE: smaller FAB docked at bottom-centre" stop-button branch (no longer needed — only the hero mic remains).
- The now-unused locals/helpers tied to list editing: `editingIndex`, `editDesc`, `editPrice`, `beginEdit`, `commitEdit`, `prevCountRef`/`justLandedFrom`, `liveTotal`, `listRef`, `pinnedRef`, `onListScroll`, the `showList` / `hasItems` / `hasPending` flags, and the list `useEffect`s.

Props stay exactly as they are (`liveItems`, `pendingItems`, `transcript`, `onUpdateItem`, `onDeleteItem`, etc.) so the call site is unaffected; they're just no longer read. (Cleanup of the call site + pipeline is a separate follow-up.)

### 2. Recording state — hero mic with breathing glow

A single centred composition on the existing `bg-ink` surface:

- Off-centre **breathing glow blob** behind everything: `absolute … bg-lime/15 blur-[130px] rounded-full` with a slow `animate-[pulse_4s_ease-in-out_infinite]` (matches the site's glow-blob language; respects reduced motion via existing tokens).
- **Large circular mic presence**: lime halo ring(s) + the existing 144px lime disc with the `VoiceWaveform` glyph (kept from current empty-state mic), with `MicLevelRings` already wrapping it for voice-reactive halos.
- `**MicLevelBars**` rendered directly beneath the disc so the bars visibly react to the user's voice (the existing component already binds to `streamRef`).
- **Timer secondary**: `formatMMSS(seconds)` + lime pulse dot kept, but smaller (`text-sm`/`num`) and `text-paper/50`, placed under the bars.
- **One calm label** above the mic: "Listening…" in the existing uppercase-tracked-widest kicker style. No per-item "Got it" chatter.

The stop button stays prominent — the hero mic disc itself is the stop control during recording (same `onClick={idle ? onStart : onStop}` it already has, same `Square` icon when `recording`).

### 3. Building state — shimmering skeleton quote

When `transcribing` (or `building`) is true, swap the mic composition for:

- Same `bg-ink` surface, same off-centre glow blob (continuity — feels like one moment).
- Lime kicker "Building your quote" + a thin full-width shimmer progress bar (re-using `animate-shimmer` + the existing gradient already used by `pendingItems`).
- **3–4 skeleton line-item rows**, each:
  - `rounded-lg bg-paper/[0.06] border-l-2 border-lime pl-3 pr-3 py-3`
  - Inner shimmer block (`animate-shimmer` gradient) for the description, plus a narrow shimmer block on the right for the price.
  - Staggered with `animationDelay` of 0/120/240/360ms so they pulse in sequence.
- Purely decorative — no real data. Disappears the moment `draft` is set because the parent unmounts the overlay (existing behaviour — unchanged).

### 4. Preserved as-is

- The `sr-only` aria-live announcement region and its `announcement` string.
- `onClose`, `onStop`, `onTypeInstead`, `onRetryTranscription` controls and the error branch in the bottom text area (kept verbatim).
- The `lastTranscript` re-record/use-anyway block at the bottom.
- `createPortal` mount, safe-area paddings, `bg-ink text-paper` shell.
- `finaliseFromAudio`, the recording state machine, `draft`/`!draft` split, and everything outside `VoiceOverlay`.

## Technical notes

- Only existing tokens: `lime`, `ink`, `paper`, `num`/Bebas, DM Sans, `animate-shimmer`, `animate-ping`, `animate-pulse`, `MicLevelBars`, `MicLevelRings`, `VoiceWaveform`. No new CSS or imports.
- Layout becomes a simpler 3-zone flex column: top kicker → centred mic-or-skeleton → bottom text/error area. The `showList ? "" : "items-center justify-between"` conditional is replaced by a single always-centred layout.
- The unused list-editing locals being removed means `onUpdateItem`/`onDeleteItem` are received but unread — fine for this prompt (call site unchanged), and the follow-up cleanup will drop them from the prop list.

## Out of scope (follow-up)

- Removing the live-pipeline state (`liveItems`, `pendingItems`, `regenerateLiveQuote`, etc.) from the parent and from `VoiceOverlay`'s props.
- Any changes to the finished-quote screen or to `finaliseFromAudio`.

Extra notes:

1. Confirm MicLevelRings actually exists. The plan references both MicLevelBars and MicLevelRings, but I only saw MicLevelBars in the code I read. If MicLevelRings isn’t a real component in the file, Lovable will either invent one or error. Tell Lovable: “if MicLevelRings doesn’t already exist, skip it and just use MicLevelBars — do not create a new component.” You don’t want a hallucinated component on launch-eve.

2. The hero mic doubling as the stop button — make sure it’s obvious. The plan keeps onClick={idle ? onStart : onStop} with a Square icon when recording. That’s clean, but during recording a user needs to know the big lime disc is now “tap to stop.” Ask Lovable to ensure the recording-state disc clearly reads as a stop control — the Square icon plus maybe the “Listening…” label sitting right by it. Otherwise people record forever waiting for a stop button that’s disguised as the mic. Low risk, just worth a word.

3. Reduced-motion. The plan says “respects reduced motion via existing tokens.” Confirm that’s actually true — breathing glow + shimmer + ping all animating at once is a lot of motion. If there’s a prefers-reduced-motion handler already in the CSS, good; if not, it’s fine to ship and add later, but don’t assume it’s handled. Minor.

4. Skeleton row count. You asked earlier about matching typical quote length — the plan fixes it at 3–4 rows, which is a sensible average. Leave it fixed; varying it would need to know the result before it exists, which you can’t. 3–4 is the right call.
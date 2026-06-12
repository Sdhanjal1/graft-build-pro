# Smoother voice quote flow

Three display-only changes to `src/routes/quotes.new.tsx` and its overlay. Whole-transcript AI generation, tombstone/edit filtering, Whisper fallback, and the 60s/30s timeouts stay exactly as they are.

## 1. Stable tiles — merge instead of replace

In `regenerateLiveQuote` (around lines 605–610), replace the wholesale `setLiveItems(filtered) / liveItemsRef.current = filtered` with an append-only merge keyed by `normDesc(description)`:

- Start from `liveItemsRef.current` as the base order.
- For each item in `filtered`, if a tile with the same `normDesc` already exists, update its `qty` and `unit_price` in place (no reorder, no description swap).
- Append any `filtered` item whose `normDesc` isn't already present.
- Do NOT remove tiles when the AI omits them mid-stream — only the existing tombstone path (`deletedDescsRef` via user delete) removes tiles.
- Assign the merged array to both `setLiveItems(next)` and `liveItemsRef.current = next`.

Result: new items animate in at the end, existing tiles never move.

## 2. Remove the visible transcript

Keep all internal capture untouched: `liveFinalRef`, `liveInterimRef`, `setLivePreview`, and the Web Speech handlers continue to feed the AI exactly as today.

In the overlay JSX (lines 2074–2095), replace the entire `livePreview`/"Hearing:" block with a quiet "listening" cue shown while `recording`:

- A pulsing lime mic dot (reuse the existing `animate-ping` halo pattern from lines 2099–2104) at a small size, plus the label "Listening…".
- Shown whenever `recording` is true, regardless of whether tiles exist yet.
- No transcript text rendered anywhere in the overlay.

The tiles list (`showList && hasItems`) remains the primary feedback.

## 3. Instant stop, background reconcile

Rework `mr.onstop` (lines 731–809) for the non-clip path:

- After flushing `finalInterim` into `liveFinalRef`, branch on `liveItemsRef.current.length`:
  - **If > 0 (tiles already exist):** build the draft immediately from current tiles — same `built` object, `setDraft`, `setDesc`, customer hydration, `clearPendingItems`, success feedback, scroll — without setting `transcribing`. Then kick off `runRegenerate(sessionId)` + `waitForPendingPhraseProcessing()` in the background (no `await` blocking the UI). When they resolve, merge any genuinely new items (same normDesc merge as #1, append-only) into the draft via `setDraft`. Guard the background merge with:
    - session still current (`sessionId === voiceSessionRef.current`, not `closeRequestedRef`),
    - user hasn't started editing — compare `JSON.stringify(currentDraftItems)` against `originalDraftRef.current`; skip merge if changed.
  - **If === 0:** keep today's behaviour exactly — `setTranscribing(true)`, await final regen + pending, re-check items, otherwise fall through to the Whisper fallback.

Spinner / `transcribing` state is no longer entered when tiles exist on stop.

## 4. Optional tuning

Leave `LIVE_PAUSE_MS` at `2000` (line 216) to minimise AI calls. Stable merge already removes the visible reshuffle, so the snappier 1500ms is not needed.

## Files touched

- `src/routes/quotes.new.tsx` — `regenerateLiveQuote` merge, `mr.onstop` instant-draft branch + background reconcile, overlay transcript block replaced with mic/Listening cue.

## Out of scope (do not touch)

- AI prompt construction, `generateFn`, `prefetchFn`.
- `deletedDescsRef` / `editedItemsRef` tombstone+edit logic and the existing filter chain.
- Whisper fallback (`runTranscribe`) and clip/edit recording paths.
- `waitForPendingPhraseProcessing`, 60s/30s timeouts.
- `setLivePreview` / `liveFinalRef` / `liveInterimRef` write sites in Web Speech callbacks.

## Acceptance

- Multi-item job: each tile appears and stays put; no reshuffle; no transcript text on screen.
- Stop with tiles present: draft appears instantly, no spinner; any late items append without reorder.
- Stop with zero tiles: unchanged — transcribing spinner + Whisper fallback as today.
- Generated quote content identical to current behaviour.

Important notes on the plan.

1. Ordering on the instant-stop branch. In the tiles-present path, set originalDraftRef.current to the new draft’s items immediately after setDraft, and before the background runRegenerate is kicked off — so an untouched draft compares equal and the background merge proceeds, while a real edit makes it differ and the merge correctly skips.

2. Background merge must re-read the latest draft, not a captured copy. When the background pass resolves, read the current draft state at that moment for both the edit-guard comparison and the append — don’t diff or merge against a stale snapshot taken before the await. Otherwise an item the user added in the gap could get lost or duplicated.

3. Keep the tombstone filter applied inside the background merge too. Late items coming from the final regenerate should still be filtered through deletedDescsRef before appending, so something the user deleted mid-recording can’t reappear via the background pass.

4. Don’t leave transcribing stuck on. Confirm the tiles-present branch never sets transcribing true, and the zero-tiles branch still clears it in all exit paths (success, fallback, and error) — so a failure in the background reconcile can’t leave the UI in a loading state.

5. Listening cue must clear on stop. When recording ends, the “Listening…” mic cue should disappear immediately as the draft appears — make sure it’s tied to recording being false, not to a separate flag that might linger.

&nbsp;
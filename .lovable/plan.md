# Editable tiles throughout the live voice flow

Goal: one editable surface from the first tile through to the final saved quote. Tiles are editable the moment they appear during the live session, edits survive subsequent regenerate passes, and a deliberate "Finish" button (not the stop square) commits the quote. The stop square stays as a secondary "cancel without finishing" control.

All changes in `src/routes/quotes.new.tsx`. No changes to `useLiveQuoteSession` or the harness — the harness already proves the live transport works; we only change what the page renders and how it merges results.

## 1. Render the editable line-items card during the live session

Today:

- "Listening…" card (line 1100) shows while `liveActive` is true and renders **read-only** rows when a draft exists.
- The full editable line-items card (line 1336) is gated `draft && !liveActive`, so it only appears after stop.

Change:

- Tighten the listening card gate to `liveActive && !draft` — it becomes a pure pre-tile placeholder ("Listening… Tiles will appear here as you speak"). Drop the read-only `<ul>` inside it.
- Loosen the editable card gate from `draft && !liveActive` to `draft` — the same editable line-items card (title input, editable description/qty/price, trash, add line, subtotal/VAT/total) renders the instant the first regenerate pass returns and stays mounted through the live session.
- The card already supports editing; no new inputs are needed. The "Edit by voice" pill in its header (line 1347) should be hidden while `liveActive` is true (the session is already live — that button would start a second one).

## 2. Preserve user edits across regenerate passes

Today `onResult` (line 207) does `setDraft({ title, line_items: g.line_items })` — it overwrites the whole list, so any in-flight edit to a tile is lost on the next pass.

Change: track which lines the user touched and merge instead of replacing while the session is live.

- Add `editedLineKeysRef = useRef<Set<string>>(new Set())`. Reset on `live.start` (alongside the existing reset block in `startRecording`) and on `finaliseLiveSession` success.
- The key is a stable identity for "this line as the AI first proposed it." Use a normalised version of the AI's original description: `normDesc(g.line_items[i].description)`. When any of the existing editable inputs (description, qty, unit_price, unit) fires `onChange`, also add the **current** `normDesc(li.description)` to the set so subsequent passes know not to clobber it. We already have `normDesc` (used in `applyVoiceEdit`).
- In `onResult`, when `liveActive` is true, merge:
  1. Walk the current `draft.line_items`. For each item whose key is in `editedLineKeysRef`, keep the existing item verbatim.
  2. For every line in `g.line_items` whose key is NOT already present in the kept set (by `normDesc`), append it.
  3. Items the user deleted (already tracked in `deletedDescsRef`) are filtered out — same rule as `applyVoiceEdit`.
  4. `setDraft({ title: draft.title || g.title, line_items: merged })`.
- When `liveActive` is false (initial pre-finish render, or a fresh session with no draft), keep today's wholesale replace behaviour.

Net result: a tile you touched stays as you left it; new things you say still arrive as new tiles; deleted lines stay deleted.

## 3. Add the "Finish / Generate quote" button

A new in-page action that commits the quote and tears down the live session.

- Render below the editable line-items card, inside the same `form`, gated `liveActive && draft && draft.line_items.length > 0`:
  ```
  <button type="button" onClick={handleFinishLive} className="…primary CTA…">
    Finish quote
  </button>
  ```
- `handleFinishLive` = call the existing `finaliseLiveSession(voiceSessionRef.current)`. That already runs the final regenerate via `live.stop({ finalize: true })`, flips `liveActive` off, and the rest of the page (customer details, payment/send, save bar) mounts automatically as those sections are still gated `draft && !liveActive`.
- Disable the button while `transcribing` is true (final regenerate in flight) so the user can't double-tap.

## 4. Keep the stop square as "cancel without finishing"

`LiveRecordingBar` (line 1050) and its `onStop={stopRecording}` stay. Change semantics:

- Visually relabel/restyle the affordance from a primary stop square to a secondary "cancel" control. Smallest viable change: keep the bar component as-is (no API change) but pass a prop or wrap it so the icon/label reads as cancel — if `LiveRecordingBar` doesn't expose a label, leave the component untouched and document in a code comment that this is now a cancel-without-commit affordance. (Open question: confirm whether you want me to visually restyle the bar, or leave the existing UI and only change the meaning. See "Open question" below.)
- Behaviour change: `stopRecording`'s live branch (line 466) currently calls `finaliseLiveSession`, i.e. it commits. Split it:
  - Rename current commit path to `handleFinishLive` (used by the new Finish button).
  - `stopRecording` (live branch) instead calls `live.stop({ finalize: false })`, clears the timers/recording flags, but **leaves `draft` in place** so the user keeps whatever tiles built up. They can edit/save manually from there, or tap voice again to resume.
  - Keep the `MIN_RECORD_MS` guard at the top of `stopRecording` for both branches.

## 5. Gates summary after the change


| Section                                  | Old gate                    | New gate                                             |
| ---------------------------------------- | --------------------------- | ---------------------------------------------------- |
| Listening placeholder card (line 1100)   | `liveActive && !voiceError` | `liveActive && !draft && !voiceError`                |
| Editable line-items card (line 1336)     | `draft && !liveActive`      | `draft`                                              |
| "Edit by voice" pill (line 1347)         | always (inside card)        | hide when `liveActive`                               |
| Finish button (new)                      | —                           | `liveActive && draft && draft.line_items.length > 0` |
| Customer / details (line 1513)           | `draft && !liveActive`      | unchanged                                            |
| Payment / send (line 1644)               | `draft && !liveActive`      | unchanged                                            |
| Sticky save bar (line 1713)              | `draft && !liveActive`      | unchanged                                            |
| Old "Generate quote" submit (typed flow) | hidden when liveActive      | unchanged                                            |


## Out of scope

- `useLiveQuoteSession`, `runRegenerate`, transcript handling — unchanged.
- Clip mode and edit-by-voice overlays — unchanged.
- Server functions / DB.

## Open question before I build

For the stop square in `LiveRecordingBar`: do you want me to visually restyle it to read as "Cancel" (different icon/colour), or leave the existing pulsing red square and only change its behaviour (still ends the session, but no longer commits)? Smallest change is behaviour-only; happy to do either. If you want a visual change, say which: e.g. swap the square for an "X" cancel icon.

Yes, visually restyle it to read as “Cancel” — swap the square for an “X” / cancel icon, and make it clearly secondary (not the pulsing primary). Here’s why it matters: if you leave a big red stop square AND add a Finish button, the user has two prominent controls and won’t know which ends the quote. The whole point is Finish is primary, cancel is the quiet escape hatch. Behaviour-only change would leave it looking like the main action. So: restyle to a small “X / Cancel,” visually secondary to the Finish button.

Three things to confirm before they build:

	1.	The merge keys on edited descriptions. Section 2 keys edits by normDesc(li.description). But what if the user edits the description itself? The key changes, and the next pass might not recognise it as “touched.” Confirm: when a user edits a line, it’s tracked by a stable identity (its original AI description or an index/id), not the live-edited text — otherwise editing a description could let a later pass duplicate it. This is the one subtle hole in the plan.

	2.	The Finish button must always be reachable. It’s gated liveActive && draft && line_items.length > 0. Good — but confirm it’s positioned so it’s visible without scrolling past a long tile list (sticky, or always in view). The primary action can’t require hunting.

	3.	Cancel keeps the tiles (section 4). They’ve got stop calling finalize: false but leaving draft in place. Confirm that’s the intent — cancel ends listening but doesn’t wipe what’s built, so the user can still save manually. That’s the right behaviour; just confirm it’s not discarding.
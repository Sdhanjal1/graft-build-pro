# Keep live tiles on the listening surface

All changes in `src/routes/quotes.new.tsx`. Pure render-gate edits — no changes to the live hook, regenerate logic, or generation flow.

## 1. Show tiles inside the "Listening…" card

The "Listening…" block at ~line 1100 currently renders only when `!draft`. Change the gate to render while `liveActive` is true (regardless of draft), and when `draft` exists, render a read-only list of the current `draft.line_items` underneath the "Listening…" header inside that same card.

- Gate: `{liveActive && !voiceError && (...)}` (drop the `!draft` part).
- Inside the card, below the existing "Listening…" header/subtext, when `draft` exists map `draft.line_items` to compact, non-editable tiles (description + qty × unit price + line total). These mirror the final tile visuals but render as plain divs — no inputs, no delete buttons, no "add line" button. They replace in place as each regenerate pass swaps `draft`.
- The existing live stop bar (~line 1050) is unchanged and stays visible.

## 2. Defer the full editable quote layout until stop

For each section that makes up the final editable quote, tighten its gate from `{draft && (...)}` to `{draft && !liveActive && (...)}`:

- Editable line-items card at ~line 1312 (title input, editable rows, add-line button).
- Customer / details section at ~line 1489.
- Payment / send section at ~line 1620.
- Sticky save bar at ~line 1689.

The `!draft` empty-state gates (~lines 1155, 1266) are unchanged — they already correctly hide once a draft exists.

## 3. Transition on stop

No new code needed. When the user taps stop:

- `liveActiveRef.current` flips to false and `setLiveActive(false)` fires (existing behaviour around lines 413/437).
- The final regenerate runs and updates `draft`.
- The listening card unmounts (its gate now false), and the four sections from step 2 mount with the same `draft` — same tiles, now editable, with customer/send/save revealed.

## Out of scope

- `useLiveQuoteSession` hook.
- `runRegenerate` / transcript handling.
- Clip mode and edit-by-voice (their separate overlays remain).
- Scroll-to-draft effect (~line 882) — still fires correctly when the final layout mounts.

1. The read-only tiles must visibly update, not stack/duplicate. Step 1 says tiles “replace in place as each regenerate pass swaps draft.” Confirm that — each pass returns the full quote and should replace the displayed list, so saying three things shows three tiles that refine, not append. Since setDraft replaces wholesale, this should be automatic, but watch for it in testing (the duplication ghost we killed earlier).

2. The scroll-to-draft effect (line 882) — confirm it doesn’t fire mid-listen. Step 3 says it “still fires correctly when the final layout mounts.” Good — but make sure it only fires on the stop transition, not on every regenerate pass while live. If it scrolls on each pass during listening, the screen will jump around as you speak. It should be inert until !liveActive.

3. Empty-tiles window. Between tapping mic and the first regenerate returning, draft is null but liveActive is true — the card shows “Listening…” with no tiles yet. Confirm that reads as intentional (“tiles will appear…”) and not broken-empty. The plan handles it (the header/subtext shows regardless), just confirming the first few seconds before tile one look deliberate.
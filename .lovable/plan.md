## Problem

The Inbox empty state was already added for the true zero-messages case, but the screen still feels thin in the common early-life scenario: a brand-new user has **one system auto-reply** in the thread list and nothing else. Today that renders as a near-empty page with a single faint "Auto" row and no guidance — visually indistinguishable from "broken" or "empty".

The empty state only triggers when `threads.length === 0 && requests.length === 0`. A lone auto-reply thread bypasses it.

## Fix

In `src/routes/messages.tsx`, treat "no real activity yet" as the empty state, not just "zero rows":

1. Compute `hasRealActivity` = there is at least one thread with a non-system message, OR any quote request. A thread whose only message is `sender === "system"` (the auto-reply) does **not** count.
2. When `!hasRealActivity` and `requests.length === 0`, render the existing `EmptyState` (icon `Inbox`, title "No messages yet", body "When a customer replies to a quote or accepts one, it shows up here.") **instead of** the Messages list — even if a system auto-reply thread exists. The auto-reply is still reachable from the quote itself, so hiding it from Inbox in the first-run state is fine.
3. Keep current behaviour once any customer/you message exists: the full Messages list renders as today (auto-reply threads included).
4. Adjust the header `subtitle` so it doesn't claim "1 chat" while we're showing the empty state — in that case show "All caught up" (existing fallback string).

No other screens, components, or logic change. Pure presentation tweak inside `messages.tsx`.

## Technical details

- New derived value near the existing `unreadThreadTotal`:
  ```ts
  const hasRealThread = threads.some(t => t.last.sender !== "system");
  const showEmpty = !hasRealThread && requests.length === 0;
  ```
- Replace the current `threads.length === 0 && requests.length === 0` guard on the EmptyState with `showEmpty`.
- Replace the Messages section guard `threads.length > 0` with `!showEmpty && threads.length > 0`.
- In the `subtitle` memo, when `showEmpty` is true, return `"All caught up"` and skip the chat/request counts.

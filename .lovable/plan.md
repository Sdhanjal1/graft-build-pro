## Fix broken `position: fixed` caused by PullToRefresh transform

**File:** `src/components/PullToRefresh.tsx` (~line 104–106)

**Problem:** The content wrapper always sets `transform: translateY(${pull}px)`. Even at rest (`pull === 0`), that's still a transform value, which creates a CSS containing block. Any `position: fixed` descendant (the quote-draft Save/Send bar) then anchors to this wrapper — only as tall as the page content — instead of the viewport. On short drafts, the bar floats mid-screen with a gap below it.

**Change:** Only apply the transform during an active pull or refresh:

```ts
transform: pull > 0 || refreshing ? `translateY(${pull}px)` : "none",
```

Keep the existing `transition` line as-is.

**Why this works:** At rest, `transform: none` removes the containing block, so `fixed bottom-0` once again anchors to the viewport. The pull gesture and refresh state still animate normally because the transform reappears the moment `pull > 0` or `refreshing` is true.

**Out of scope:**
- The draft form's `pb-28` content reserve (fixed bar still overlays content — keep the reserve).
- The no-draft flex-column layout (already correct).
- Voice / AI / recording logic.
- The full-screen voice overlay (`fixed inset-0`) — unaffected, or slightly more correct.

**Acceptance:**
- Quote-draft Save/Send bar sits flush at the bottom of the viewport on short and long drafts, with and without a customer.
- Pull-to-refresh on Home and list screens still works (indicator appears, content translates down, refresh fires).
- Voice overlay still covers the full screen.

# Three Operational Polish Improvements

Implement the three changes as specified, with small corrections where the prompt's variable names don't match the actual codebase.

---

## 1. Haptic + Sound at "Quote Ready"

**File:** `src/routes/quotes.new.tsx` (~line 477, inside `regenerateLiveQuote` success branch, right after `setLiveItems(g.line_items)`).

- Fire `navigator.vibrate(20)` if available.
- Create a short 800Hz sine tick (~100ms) via `AudioContext`, wrapped in try/catch.
- Guard with a `firstItemsLandedRef` (useRef boolean) so it only fires the **first time** items appear during a session, not on every regeneration / debounce cycle. Reset the ref when the user starts a new recording (`startRecording`) and after submit/reset.

**Why the ref:** `regenerateLiveQuote` is debounced and re-runs as the user keeps speaking. Without a guard, we'd ping repeatedly and annoy the tradesperson.

---

## 2. Collapsible Transcript Below Live Items

**File:** `src/routes/quotes.new.tsx`, inside `LiveBuildingPanel` (~line 1830, right after the `</ul>` that closes the live items list).

`desc` lives in the parent component (line 95), not in `LiveBuildingPanel`. Two small wiring changes:

- Add `transcript: string` to `LiveBuildingPanel`'s props interface (~line 1582).
- Pass `transcript={desc}` from the parent call site (~line 835).
- Render the `<details>` block exactly as the prompt specifies, gated on `liveItems.length > 0 && transcript.trim()`.

Tokens: use existing semantic classes already in this file (`text-paper/60`, `bg-paper/[0.04]`, `border-paper/10`) — no new colors.

---

## 3. Money Summary Card at Top of Quote Detail

**File:** `src/routes/quotes.$quoteId.tsx`, immediately after `<PageHeader ... />` at line 551.

Corrections vs the prompt (the field names don't exist on `quote`):


| Prompt said                      | Actual source                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| `quote.vat_registered`           | `userProfile.vat_registered` (already used at line 656)                                     |
| `quote.configured_deposit`       | the `configuredDeposit` variable already in component scope (used at lines 800, 1046, 1086) |
| `quote.subtotal` / `quote.total` | correct as-is                                                                               |
| VAT amount                       | recompute as `(quote.subtotal                                                               |


Render the bordered card exactly as designed:

- Subtotal + VAT (conditional) in a 2-col grid.
- Total row with lime accent.
- Deposit-due / Balance rows shown only when `quote.payment_timing === "deposit_then_balance" && configuredDeposit > 0`.

**Duplication note:** the existing totals block at lines 1543–1560 stays — that one is the authoritative bottom-of-quote summary near the line items. The new card is a header glance card. Worth flagging because two totals on one page can read as noise; happy to remove the bottom one in a follow-up if you'd prefer a single source.

---

## Files Touched

- `src/routes/quotes.new.tsx` — ref + haptic/sound block, one new prop on `LiveBuildingPanel`, `<details>` transcript block.
- `src/routes/quotes.$quoteId.tsx` — money summary card after `PageHeader`.

No backend, schema, or status-flow changes. Fully reversible.

## Risk

Zero. All client-only presentation. Audio/vibrate are feature-detected and try/caught.

## Effort

~45 minutes total.

## Open question

Do you want me to **remove** the existing bottom totals block (lines 1543–1560) on the detail page now that the header card shows the same numbers, or keep both?

### On the Duplicate Totals Question

**Keep both totals sections.** Here's why:

- **Header card** (new) = glance-level money story. "How much is this quote?" Nav sees it immediately.
- **Bottom block** (existing, lines 1543–1560) = detail-level breakdown. Sits with the line items, right where the numbers come from. "Where did these totals come from?"

They serve different cognitive purposes. The header card is for "what's the big number," the bottom block is for "verify the math." Keep both.
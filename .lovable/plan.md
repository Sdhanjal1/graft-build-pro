## Lovable Prompt: Hybrid Single-Screen Quote Workflow Restructure (FINAL)

Complete restructure of the quote workflow. Users do all creative work (voice, edit, review) on one screen (`/quotes/new`). Post-send operations (status, payments, invoices) stay on the detail page (`/quotes/$quoteId`). No route deletions, no broken Stripe returns or notification URLs.

**Effort estimate:** 4–6 hours. **Risk:** Low.

---

# PART 1: `/quotes/new` — Complete Voice Quote Workflow

## 1a. Remove "Voice to text" Button (Redundant)

**File:** `src/routes/quotes.new.tsx` (~line 835, in the page JSX)

**Find:** The "Voice to text" button/card that appears after voice is initiated.

**Action:** Delete it entirely. It's redundant once items are already generated. Users don't need to re-trigger voice-to-text.

## 1b. Add Editable Title Field

**File:** `src/routes/quotes.new.tsx` (~line 900, inside the LiveBuildingPanel / quote preview section, before the items list)

**Current state:** Title is shown in the PageHeader and locked.

**Change:** Add an inline editable title field:

```tsx
{/* Editable title field */}
<div className="px-5 py-3 space-y-2 border-b border-paper/10">
  <p className="text-xs uppercase tracking-widest font-semibold text-paper/60">Quote title</p>
  <input
    type="text"
    value={draft?.title || ""}
    onChange={(e) => {
      if (!draft) return;
      const updated = { ...draft, title: e.target.value };
      setDraft(updated);
      liveItemsRef.current = updated.line_items;
    }}
    maxLength={80}
    className="w-full px-3 py-2 rounded-lg bg-paper text-ink font-bold text-lg border border-paper/20 focus:outline-none focus:ring-2 focus:ring-lime"
    placeholder="e.g., Supply & fit new boiler"
  />
</div>

```

**Why:** Users can see and edit the title before saving, no page bounce.

## 1c. Change Save Buttons to "Save as Draft" / "Save & Send"

**File:** `src/routes/quotes.new.tsx` (~line 1500+, the sticky bottom action bar)

**Current code** (something like):

```tsx
<button onClick={save} className="...">Save Quote</button>

```

**Replace with:**

```tsx
<div className="flex gap-2">
  <button
    onClick={() => saveDraft()}
    className="flex-1 px-4 py-3 rounded-2xl bg-paper/10 border border-paper/20 text-paper font-bold hover:bg-paper/20 transition"
  >
    Save as Draft
  </button>
  <button
    onClick={() => saveAndSend()}
    className="flex-1 px-4 py-3 rounded-2xl bg-lime text-ink font-bold shadow-[0_6px_16px_-8px_rgba(200,224,74,0.7)] active:scale-[0.99] transition"
  >
    Save & Send
  </button>
</div>

```

**Logic:**

- `saveDraft()` → save with `status: "pending"` (marked as draft), stay on same page, show toast "Saved as draft"
- `saveAndSend()` → save with `status: "pending"`, THEN open send sheet immediately

## 1d. Add Send Sheet (Appears After "Save & Send")

**File:** `src/routes/quotes.new.tsx` (new section, around line 1450)

**Add a new state and sheet:**

```tsx
const [sendSheetOpen, setSendSheetOpen] = useState(false);
const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);

// After successful saveAndSend:
const saveAndSend = async () => {
  try {
    const result = await save(); // existing save logic
    if (result?.id) {
      setSavedQuoteId(result.id);
      setSendSheetOpen(true);
    }
  } catch (e) {
    setError(e instanceof Error ? e.message : "Failed to save quote");
  }
};

```

**Add send sheet JSX** (at the end of the component, before closing tag):

```tsx
{/* Send sheet — appears after Save & Send */}
<SendQuoteSheet
  open={sendSheetOpen}
  onOpenChange={setSendSheetOpen}
  quoteId={savedQuoteId}
  onSuccess={() => {
    // After send, navigate to detail page with success state
    if (savedQuoteId) {
      navigate({ to: `/quotes/${savedQuoteId}`, search: { sent: "1" } });
    }
  }}
/>

```

**SendQuoteSheet Behavior:**

- Present all send options equally (WhatsApp, Email, SMS, Copy link)
- Do NOT auto-focus WhatsApp — let user choose
- After user sends via any channel, show "Quote sent!" toast
- Navigate to `/quotes/$quoteId?sent=1` so the detail page can show success state
- User can then view the quote, mark it complete, track payment, etc.

**Why:** Users don't leave the flow. They speak → edit → save → send, all in one session.

## 1e. Update the Save Handler to Support Both Paths

**File:** `src/routes/quotes.new.tsx` (existing `save` function, ~line 761)

**Current:** Saves and navigates to `/quotes/$quoteId`.

**Change:**

- If coming from `/quotes/new?edit=<id>` (edit mode), save and navigate back to list.
- If creating new, save and DON'T navigate — let the send sheet / user choice control what's next.
- Add a `mode` param to `save()`: `save(mode: "draft" | "send_ready")`.

```tsx
const save = async (mode: "draft" | "send_ready" = "send_ready") => {
  if (!draft || saving) return;
  setSaving(true);
  setError(null);
  try {
    const q = editId
      ? await updateGeneratedQuote({...})
      : await saveGeneratedQuote({...});
    
    if (editId) {
      // Edit mode: save and return to list
      navigate({ to: "/quotes" });
      toast.success("Quote updated");
    } else if (mode === "draft") {
      // Save as draft: show toast, stay on page
      toast.success("Saved as draft");
      return q;
    } else if (mode === "send_ready") {
      // Save & Send: return quote object for send sheet to mount
      return q;
    }
  } catch (e) {
    setError(e instanceof Error ? e.message : "Failed to save quote");
    toast.error("Could not save quote", { description: error });
    throw e;
  } finally {
    setSaving(false);
  }
};

```

## 1f. Update List Links: Route by Status

**File:** `src/routes/quotes.index.tsx` (~line 311, the row link)

**Current:**

```tsx
<Link to={`/quotes/${quote.id}`}>

```

**Change to:**

```tsx
<Link to={
  quote.status === "pending"
    ? `/quotes/new?edit=${quote.id}`
    : `/quotes/${quote.id}`
}>

```

**Why:** Drafts (pending status) open in the editor. Sent/accepted/paid quotes open on the detail page.

---

# PART 2: `/quotes/$quoteId` — Post-Send Operations Only

## 2a. Remove All Edit UI from Detail Page

**File:** `src/routes/quotes.$quoteId.tsx`

**Remove these sections entirely:**

- "Edit via voice" button (line ~500)
- "Edit title" button (line ~510)
- Edit line item inline controls (if they exist on detail page)
- Any "edit" affordance in the header

**Why:** Editing always happens on `/quotes/new`. The detail page is read-only + operations.

## 2b. Keep Post-Send Operations (Status, Deposits, Payments, Invoices)

**What stays (no changes to logic, just remove edit UI):**

- Status badge and timeline
- "Mark as accepted" / "Mark complete" / "Mark paid" buttons
- Deposit configuration and payment tracking
- Invoice button
- Portal regenerate link
- Send chaser (WhatsApp, SMS, email)
- Materials checklist
- Delete / duplicate buttons
- Money card (summary, not edit)

**No changes to the logic here** — just remove the edit buttons/flows.

## 2c. Add "Quote Sent!" Success State

**File:** `src/routes/quotes.$quoteId.tsx` (at the top of the page, after PageHeader)

**Check for the** `sent` **query param and show success:**

```tsx
// At the top, after quotes loads
const searchParams = useSearch({ from: '/quotes/$quoteId' });
const wasJustSent = searchParams.sent === "1";

// In JSX, right after PageHeader:
{wasJustSent && (
  <div className="mx-5 mt-4 p-4 rounded-lg bg-lime/10 border border-lime/40 flex items-center gap-3">
    <span className="flex h-6 w-6 rounded-full bg-lime/20 items-center justify-center">
      <Check className="h-4 w-4 text-lime font-bold" />
    </span>
    <div>
      <p className="text-sm font-semibold text-lime">Quote sent!</p>
      <p className="text-xs text-lime/70">Waiting for customer response</p>
    </div>
  </div>
)}

```

**Why:** Confirms to the user that the send actually worked. Then they can see status, mark as accepted, track payment, etc.

## 2d. Conditionally Hide Detail Page Until Sent

**Optional but smart:** If a user lands on `/quotes/$quoteId` for a `pending` status quote (shouldn't happen in normal flow, but defensive), redirect them to `/quotes/new?edit=<id>`:

```tsx
// At the top of the component
if (quote.status === "pending" && !searchParams.sent) {
  return <Navigate to={`/quotes/new?edit=${quote.id}`} />;
}

```

---

# PART 3: Quote List — Show Drafts Clearly

**File:** `src/routes/quotes.index.tsx`

## 3a. Add Draft Section / Label with Visual Distinction

**Add a "Drafts" section at the top:**

```tsx
{/* Drafts section */}
{quotes.filter(q => q.status === "pending").length > 0 && (
  <section className="space-y-3 mb-6">
    <h2 className="px-5 text-xs uppercase tracking-widest font-semibold text-paper/60">Drafts</h2>
    {quotes
      .filter(q => q.status === "pending")
      .map(quote => (
        <QuoteRow key={quote.id} quote={quote} isDraft />
      ))}
  </section>
)}

{/* Sent & history section */}
{quotes.filter(q => q.status !== "pending").length > 0 && (
  <section className="space-y-3">
    <h2 className="px-5 text-xs uppercase tracking-widest font-semibold text-paper/60">Sent & History</h2>
    {quotes
      .filter(q => q.status !== "pending")
      .map(quote => (
        <QuoteRow key={quote.id} quote={quote} />
      ))}
  </section>
)}

```

## 3b. Update QuoteRow to Show Draft Label with Lime Accent

**Draft rows get visual distinction (lime accent) so it's clear they need finishing:**

```tsx
<div className={`rounded-lg px-4 py-3 cursor-pointer transition ${
  isDraft 
    ? "bg-lime/10 border-l-2 border-lime" 
    : "bg-paper/[0.04]"
}`}>
  <div className="flex items-center justify-between">
    <div>
      <p className="font-bold text-paper">{quote.title}</p>
      {isDraft && <p className="text-xs text-paper/60">Draft — continue editing</p>}
      {!isDraft && <p className="text-xs text-paper/60">{quote.status}</p>}
    </div>
    <p className="font-bold text-lime">{formatGBP(quote.total)}</p>
  </div>
</div>

```

**Why:** No "Continue editing" button needed. The lime accent + label makes it obvious the row is tappable and will open the editor. Consistent with how the rest of the app works.

## 3c. Link Behavior

Drafts link to `/quotes/new?edit=<id>`. Sent quotes link to `/quotes/$quoteId`. (Already done in Part 1f.)

---

# PART 4: Data & Edge Cases

## 4a. Draft vs Pending Status

**Current:** Both "draft" and "pending" are the same `status: "pending"` in the schema.

**Recommendation:** Keep it that way for now. Don't add a new enum. `pending` covers both "saved but not finished" and "saved, ready to send".

**If later you want a true "draft" distinct from "pending":**

- Add `status: "draft"` to the `quotes.status` enum
- Migration: `UPDATE quotes SET status='draft' WHERE status='pending' AND created_at > now() - interval '7 days' AND sent_at IS NULL` (drafts are recent + unsent)
- But that's post-launch work.

## 4b. Stripe Return Handling

**Current:** After Stripe Checkout, user is sent to `/quotes/$quoteId?paid=1`. The page mounts and reads this param to flip status.

**No change needed.** `/quotes/$quoteId` still exists, so Stripe returns work as-is.

## 4c. Push Notifications

**Current:** Notifications link to `/quotes/<id>`. After send, the quote status changes to `sent` or `accepted`.

**No change needed.** When the user opens a sent quote from a notification, they land on `/quotes/$quoteId` (the detail page), which is correct.

## 4d. Portal Links

**Current:** Portal tokens point to `/portal/c/<code>`. That route is untouched.

**No change needed.**

---

# PART 5: UI Adjustments

## 5a. Remove "Voice to text" Button

Already covered in 1a.

## 5b. Title Field Styling

Use existing semantic tokens (text-paper, bg-paper, border-paper/20, focus:ring-lime). Match the input styling in the money card or edit fields elsewhere in the app.

## 5c. Send Sheet Styling

Reuse `SendQuoteDialog` styles or refactor to a `<SendQuoteSheet>` component. Should feel like a natural continuation of the quote flow, not a modal interruption.

---

# PART 6: FINAL DECISIONS ON OPEN QUESTIONS

## Decision 1: Send Sheet Auto-Focus

**Answer:** Let user choose. Present all send options equally (WhatsApp, Email, SMS, Copy link). Do NOT auto-focus WhatsApp.

**Why:** Nav might want to email first, or SMS. Forcing WhatsApp assumes all his customers use it.

## Decision 2: After Sending

**Answer:** Show "Quote sent!" success state on the detail page.

**Implementation:** After send, navigate to `/quotes/$quoteId?sent=1`. The detail page reads this param and shows a success card (see Part 2c).

**Why:** Confirms the send worked. Then Nav can track status, mark as accepted, handle payment, etc., all in one place.

## Decision 3: "Continue Editing" Button on Draft Row

**Answer:** No explicit button. Visual distinction only (lime accent + label).

**Why:**

- Consistent with how the rest of the app works (tap row to open)
- Saves mobile screen space
- Avoids ambiguity (button vs row tap)
- The lime accent + "Draft — continue editing" label is explicit enough

**Implementation:** Draft rows have `bg-lime/10 border-l-2 border-lime` styling (see Part 3b). No button needed.

---

# Summary of Changes


| File                  | Change                                                                                          | Lines | Risk     |
| --------------------- | ----------------------------------------------------------------------------------------------- | ----- | -------- |
| `quotes.new.tsx`      | Remove voice-to-text button, add title field, change buttons, add send sheet, update save logic | ~150  | Low      |
| `quotes.$quoteId.tsx` | Remove edit buttons, add success state, add status redirect guard                               | ~50   | Low      |
| `quotes.index.tsx`    | Add draft section, visual distinction on draft rows, update link routing by status              | ~60   | Very low |


**No schema changes. No migrations. No broken URLs.**

---

# Testing Checklist

1. **New quote flow:** Speak → edit title/items → "Save as Draft" → quote appears in drafts list with lime accent and "Draft — continue editing" label.
2. **Draft edit:** Tap draft in list → opens `/quotes/new?edit=...` → can re-record or edit → save → back to list.
3. **Save & Send:** Speak → edit → "Save & Send" → quote saves → send sheet appears with all options visible → select WhatsApp/Email/SMS → send → navigate to `/quotes/$quoteId?sent=1` → see "Quote sent!" success card.
4. **Sent quote:** Tap sent quote in list → opens `/quotes/$quoteId` → see status, deposit, mark paid, etc. NO edit buttons.
5. **Stripe return:** After Stripe Checkout, `?paid=1` param → quote status flips (existing behavior, unchanged).
6. **No edit buttons on detail page:** Verify "Edit via voice" and "Edit title" buttons are gone from `/quotes/$quoteId`.
7. **Draft visual distinction:** Confirm draft rows have lime accent and are visually distinct from sent quotes.

---

# Final Notes

- This is the production architecture. No more changes after this.
- After this ships, Nav does end-to-end validation (speak → edit → send → track payment).
- Post-launch roadmap: true draft status, edit history, materials checklist day-of integration.

**Ship this.**
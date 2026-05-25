## Changes to `src/routes/quotes.new.tsx`

### 1. State (replace existing dropdown state)
```
clientName, clientPhone                     // new customer inputs / selected name
customerMode: "none" | "existing" | "new"   // which UI is showing
customerSearch                              // search query inside modal
filteredClients = userClients filtered by customerSearch (no slice)
```
Drop `clientOpen` and `clientMatches`.

Keep the `vat` state variable (still passed to `saveGeneratedQuote` and used in totals) but default it to `userProfile.vat_registered`. No UI toggle.

### 2. Customer section UI (replaces current dark dropdown card)

Two equal-width buttons stacked or side-by-side above Generate quote:
```
[ Existing customer ]   [ + New customer ]
```
- Same width (`grid grid-cols-2 gap-3`), same height, both card-surface style.
- Active button gets lime fill; the other stays neutral.
- Below the buttons, render one of:
  - `customerMode === "existing"` and a name is selected → small "Selected: {name}" chip with a Change link.
  - `customerMode === "new"` → inline card with two fields only:
    - Name (required)
    - Phone number (tel)
  - Otherwise nothing.

### 3. Full-screen "Existing customer" modal
- Triggered by tapping "Existing customer".
- Fixed overlay (`fixed inset-0 z-50 bg-paper`) with safe-area padding.
- Sticky header: back chevron, title "Choose customer", search input below.
- Clean list of `filteredClients`: each row shows name (bold) and address (muted), divided by hairline borders, full-width tap target.
- Tap row → set `clientName`, clear modal, set mode to "existing".
- Empty state when no matches: muted "No customers match".
- Remove any "Site capture client" / "New client" rows entirely (they were part of the old dropdown).

### 4. Remove the VAT registered card
Delete the `<label className="card-surface p-4 flex items-center justify-between ...">VAT registered…</label>` block (lines ~596–609). VAT still applied silently from the profile.

### 5. Generate quote button
Stays as-is, directly below the customer area.

### 6. Save flow
No change — `save()` still uses `clientName` and `vat`. New `clientPhone` is captured locally; if you want it persisted later we can pass it to `findOrCreateClient`, but per the request we just collect the two fields at this stage.

### Files touched
- `src/routes/quotes.new.tsx` only.

# Clients pass — index, detail, new, portal panel

Scope: `src/routes/clients.index.tsx`, `src/routes/clients.$clientId.tsx`, `src/routes/clients.new.tsx`, and `src/components/CustomerPortalPanel.tsx` (the customer-portal subtree rendered on the detail page). Density, hierarchy, and a handful of small UX bugs — no data shape, RLS, or portal-functions changes.

## `clients.index.tsx`

1. **Search input.** Currently `h-11 rounded-full bg-card border border-border`. Matches the rest of the app, keep — but bump font from `text-sm` to `text-[15px]` for one-handed mobile use. Border colour stays.

2. **Row chrome density.** Cards use `p-4` with `h-12 w-12` avatar. Drop avatar to `h-10 w-10` and card padding to `p-3.5` so 6 rows fit above the fold on iPhone SE. Avatar `text-ink font-bold` → `text-sm font-bold` to keep the initials proportionate.

3. **Right-side totals.** Today the right block shows `formatGBP(total)` + `{n} quote(s)`. The total is the sum of every quote (incl. unpaid) which over-promises — relabel the eyebrow as `Quoted` and add a second line `{paidTotal} paid` when paid > 0. Falls back to just the quote count when nothing's been paid.

4. **Duplicate warning.** The amber left-border + inline "Looks similar to X" line works but the warning text wraps to two lines on narrow screens, pushing the card taller than its neighbours. Truncate the dup hint to one line (`truncate`) and move the "review" verb into a chevron + amber dot pattern: small `bg-amber-400/15 text-amber-700` chip reading `Possible duplicate` placed under the name.

5. **`New` pill.** Top-right `h-9 px-3.5 rounded-full bg-lime`. Fine. Keep.

6. **Empty state — no customers.** Uses `EmptyState` with CTA. Keep but pass `cta.variant="primary"` if available (TBC by inspection); otherwise no change.

7. **Empty state — no matches.** Same `EmptyState`. Add an "Add as new customer" CTA wired to `/clients/new?name={q}` so a failed search becomes an add-flow shortcut. (Requires `clients.new.tsx` to read the `name` search param — covered in #14.)

## `clients.$clientId.tsx`

8. **Money summary card.** "Paid to date" with `num text-4xl` works — but `text-status-accepted` on the big number reads as a status pill colour, not a money colour. Switch the amount to `text-ink` and prepend a tiny `bg-status-accepted h-2 w-2 rounded-full` dot before the eyebrow label. Keeps the green semantic without painting the whole number.

9. **Service summary + cadence card.** Already divided. The `bg-lime/30` cadence icon competes with the lime CTAs further down the page. Swap to `bg-secondary text-ink` for parity with the completed-jobs row above it. Lime is reserved for actions.

10. **Contact block density.** `p-5 space-y-3` with 5 rows + optional notes — the card is the tallest on the page. Tighten to `p-4` and `space-y-2.5`. `h-9 w-9` icon circles → `h-8 w-8`.

11. **`EditableRow` save indicator placement.** The pencil + `SaveIndicator` sit top-right inside the label row, which competes with the contextual "Call/Email/Open" link on the left. Move `SaveIndicator` inline to the right of the input (absolute-positioned inside the input wrapper) and drop the pencil icon entirely — the dashed underline already telegraphs "editable".

12. **Notes block.** Currently a separate `pt-3 border-t` section inside the contact card. Promote to its own `card-surface` below the contact card so customers' notes don't get visually buried. Eyebrow stays.

13. **Job history header.** "New quote for {firstName}" button is `bg-lime text-ink` and lives at top-right. On long first names ("Christopher") the button wraps. Switch the CTA label to a short `+ New quote` and add the first name as a section subtitle under the H2 (`<p className="text-xs text-muted-foreground">For {firstName}</p>`).

14. **Job history row.** Three lines: ref+status+certs, title, date. The cert chips can overflow into a fourth row. Wrap the chips inline at the *end* of the title line (not the ref row) so the ref+status row stays single-line and the certs only push the title when present. Keeps the metadata hierarchy clean.

15. **Job history empty state.** `EmptyState` with `New quote` CTA. Fine. Keep.

## `clients.new.tsx`

16. **`Field` density.** `p-4` per field. Form is 6 fields tall — `p-3.5` reads tighter without losing tap area.

17. **Property type chip pickers.** The two-tier picker (Homeowner → subtype) works but the subtype row appears only when Homeowner is selected, which makes the form jump. Reserve space with a `min-h-[2.25rem]` wrapper around the subtype row so the layout doesn't shift.

18. **Sticky save bar.** Mirror the safe-area pattern from the Quote detail (sixth pass #14): `bottom: calc(0 + env(safe-area-inset-bottom))` and drop the gradient strip into a dedicated `h-6 -mb-2` above the button so the button sits on solid paper. There's no `BottomNav` on this route.

19. **Phone/email validation hint.** Currently fires on blur as `text-[11px] text-destructive`. Keep the timing but switch the colour to `text-amber-700` — these are warnings (might still be valid, just non-UK formatting), not errors that block submit. Save button doesn't check them.

20. **Read `name` search param.** Wire `Route` to accept an optional `?name={q}` search param (Zod or simple validator) so the index "Add as new customer" shortcut from #7 pre-fills the name field via `Route.useSearch()`.

## `CustomerPortalPanel.tsx`

21. **Replace `confirm()` calls.** Two `window.confirm` uses: `onRegen` ("Generate a new portal link?") and `onDelete` ("Remove this document?"). Replace both with `AlertDialog` (same pattern as `portal.$token.tsx` and `portal.c.$code.tsx` from sixth pass). One dialog instance per panel, state keyed on action target (`{ type: "regen" } | { type: "delete-doc", id }`).

22. **Portal link card — share/copy buttons.** Four buttons in two grids reads as a button salad. Restructure as:
    - Row 1 (primary action): single full-width lime `Share link` (or `Copy link` fallback when `navigator.share` is unavailable). Detect at render.
    - Row 2 (secondary): two ghost buttons `Preview` + `Regenerate`.
    Drops one button row and clarifies the primary action.

23. **Portal-active toggle.** Native checkbox — replace with the project's `Switch` component (shadcn) for consistency with Settings (sixth pass had Settings switched to shadcn `Switch`).

24. **Service reminder card.** Inputs are `bg-secondary rounded-xl`. Fine. The save button is `bg-ink text-paper` ghost-ish — promote to `bg-lime text-ink` since it's the only state-changing action in the card, matching the "primary action per card" rule from the sixth pass.

25. **Documents card.** `select` + `Upload` label sit in the header row, which is dense. Move the kind select *into* the upload affordance: tapping `Upload` opens a tiny popover/menu of kind choices, then triggers the file picker. Out of scope to refactor as a popover — instead, drop the inline select, default `uploadKind` to `"certificate"`, and add a small `<select>` per *uploaded* document row so users re-classify after the fact. (Net effect: simpler upload flow, kind is still editable.)
    - **Schema note:** requires a server fn like `updateDocumentKind` or extending the existing `addClientDocument` shape. Confirm before building — flag as a follow-up if no such fn exists; in that case ship only the header tidy (drop the inline select, hardcode certificate as default) and leave row-level re-classification for a later pass.

26. **Document row.** "Visible" checkbox + "Delete" icon on each row crowds the line. Replace the checkbox with the shadcn `Switch` at `size="sm"`-equivalent (small custom variant) and move the trash icon into a swipe-reveal pattern using the existing `SwipeRow` component (already imported across the project). Keeps the row readable and matches the iOS-native mental model.
    - **Out of scope if `SwipeRow` doesn't fit list items here** — fall back to a `MoreVertical` overflow menu (Radix dropdown) per row.

## Out of scope

- `findOrCreateClient`, `updateClientFields`, `regeneratePortalCode`, `addClientDocument` — server fns and data shape are untouched.
- `useDataVersion`, `useSession`, `useAutoSave` plumbing.
- `detectCertifications`, trade resolution.
- RLS, storage bucket setup.
- `EmptyState` internals.

## Technical notes

- All client routes use mock-data fallbacks (`getClient`, `quotesForClient`) — visual changes should render correctly in both the seeded-mock and real-data paths.
- `AlertDialog` import path established in the sixth pass: `@/components/ui/alert-dialog`.
- `Switch` import: `@/components/ui/switch`.
- `clients.new.tsx` search param: use a simple inline validator `(s): { name?: string } => ({ name: typeof s.name === "string" ? s.name : undefined })` — no Zod dependency needed.

## Skipped (defer to later pass)

- **`Field` unification** (still deferred from Settings pass 5). `clients.new.tsx` has its own local `Field` and `clients.$clientId.tsx` has `Row` + `EditableRow`. Three separate "labelled input" patterns. Unification is a project-wide ergonomics win but spans Settings, Quote detail, New client — too broad for this pass.

## Next pass after this

- `messages.tsx` (chase thread + composer)
- `quotes.index.tsx` (list / filters / empty states)

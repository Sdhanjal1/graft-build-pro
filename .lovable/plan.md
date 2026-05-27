## Goal
Fix the "Add a client to send" flow on a quote (AssignClientDialog) so adding a customer works, and rename the CTA to "Add Customer".

## Investigation
1. Reproduce the failure in the preview:
   - Open a quote with no client assigned, tap "Add a client to send".
   - Try both paths: (a) selecting an existing client, (b) typing a new name and tapping the create button.
   - Capture console errors and network errors (Supabase insert on `clients`, update on `quotes.client_id`).
2. Likely suspects in `src/components/AssignClientDialog.tsx` + `src/lib/user-data.ts`:
   - `findOrCreateClient` insert payload may be missing a required field, or RLS rejects (user_id mismatch).
   - `assignClientToQuote` may fail silently or throw without surfacing.
   - `userClients` cache may be empty on first open because data hasn't loaded yet (dialog shows "No clients yet" even when clients exist).
3. Confirm the actual root cause from the reproduction before patching — do not guess-fix.

## Fix
- Apply the minimal targeted fix for whichever of the above is the real cause (e.g. ensure clients are loaded before the dialog opens, surface the real error via `toast.error`, or correct the insert payload).
- Keep behaviour otherwise identical — selecting an existing client and creating a new one both assign to the quote and close the dialog.

## UI copy change
- In `src/components/AssignClientDialog.tsx`, change the create button label from `Add "{name}" as new client` to `Add Customer` (icon unchanged).
- Leave the dialog title/description and the existing-client list rows as-is.

## Out of scope
- No changes to the standalone `/clients/new` page, customer schema, or quote model.
- No styling overhaul of the dialog.

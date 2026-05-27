## Goal
Make `/clients/new` reliably save a customer, and surface the actual error if it doesn't.

## Investigation
1. Reproduce in preview: open `/clients/new`, fill in name, tap **Save customer**. Capture the network request to `clients` (status + response body) and any console error.
2. Likely suspects in `src/routes/clients.new.tsx` + `findOrCreateClient` (`src/lib/user-data.ts:732`):
   - Auth not hydrated yet → `requireUserId()` throws or `auth.uid()` is null and RLS rejects the insert.
   - Inline `setError` shows a small message but no `toast`, so users perceive "nothing happens".
   - Save handler silently no-ops if `name` is empty (currently `if (!name.trim() || saving) return;`).

## Fix
- In `src/routes/clients.new.tsx`:
  - Replace silent `setError` with a `toast.error(...)` (matching the rest of the app) AND keep inline message.
  - On submit, log `error.message` / `error.code` to console so future failures are diagnosable.
  - Ensure `saving` is always reset (already done on error; verify success path navigates).
- In `src/lib/user-data.ts` `findOrCreateClient`:
  - If `requireUserId()` fails because the Supabase session hasn't restored yet, await `supabase.auth.getSession()` once before falling back to a clearer error message ("Please sign in again").
  - Surface Supabase error `message` (currently throws raw error object — fine, but ensure `.message` is non-empty; wrap with `new Error(error.message || 'Could not save customer')`).
- No DB / RLS changes — existing policy `auth.uid() = user_id` is correct and the insert already sets `user_id`.

## Out of scope
- Changes to the AssignClientDialog flow, clients schema, or quote flow.
- Visual redesign of `/clients/new`.

## Verification
- Save a new customer end-to-end in preview; row appears in `clients` and we navigate to `/clients/$id`.
- Force a failure (e.g. clear name) → user sees a clear toast, not silent nothing.
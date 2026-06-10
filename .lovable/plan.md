# Code audit — issues found and proposed fixes

Scope: only fix what's already shipped. No new features, no schema changes, no AI/business-logic changes.

## Confirmed bugs (worth fixing)

### 1. Inbox "Create quote" link is dead — `prefill` is silently dropped

`src/routes/messages.tsx:130` links to `/quotes/new` with `search={{ prefill: r.body } as any}`, but `src/routes/quotes.new.tsx:76` `validateSearch` only whitelists `voice`, `clientId`, `edit`. TanStack Router strips unknown search keys, and `NewQuotePage` never reads `prefill` anyway, so tapping "Create quote" from an inbox request does nothing useful.

Fix (pick one — recommend A since the link already exists):

- A. Add `prefill?: string` to `validateSearch` in `quotes.new.tsx`, then in `NewQuotePage` read it via `Route.useSearch()` and seed `setDesc(prefill)` in a one-shot effect (guarded by a ref so subsequent edits aren't overwritten). Drop the `as any` cast in `messages.tsx`.
- B. Remove the `Create quote` CTA from inbox until wiring is real.

### 2. `BottomNav` unread query 401-spams unauthenticated users on app routes

`BottomNav` runs `getMyIncomingRequests` (auth-required) whenever `showAppChrome` is true. If a logged-out visitor lands on any app route (e.g. `/app` before redirect, transient session loss), the query fires, hits `requireSupabaseAuth`, and throws 401. Currently masked by `retry: false`, but it still produces a network error per nav and a noisy server log.

Fix: gate the query on session presence. Read `useSession()` in `BottomNav` and set `enabled: !hide && !!session`. No new behavior — just no query without a user.

### 3. `inbox-unread-count` cache never invalidates when a request is marked read

`messages.tsx` calls `markRequestRead` then `void load()`, which refreshes its own local state but does NOT touch the `["inbox-unread-count"]` query key used by `BottomNav`. The lime dot only clears on the next 30 s refetch interval (or window-focus).

Fix: in `messages.tsx`, grab `useQueryClient()` and call `queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] })` after a successful `markRead`. Same in any future read-marking spot.

### 4. `useEffect` cleanup race in `messages.tsx`

`useEffect` subscribes to a realtime channel and calls `void load()` on inserts, but `load()` uses `setMessages`/`setRequests` without a mounted guard. If the component unmounts mid-fetch, React logs a set-state-on-unmounted warning in dev. Add a `let cancelled = false;` flag inside the effect and bail out of the setters when cancelled; also do the same inside `load`.

### 5. `quotes.new.tsx` `validateSearch` type narrowing

Line 76 returns a union-shaped object without explicit return type. TanStack picks up the inferred type but downstream `navigate({ to: "/quotes/new", search: {}, replace: true })` works only because every key is optional. Add an explicit return type (`{ voice?: 1; clientId?: string; edit?: string; prefill?: string }`) so future links don't silently drop params (this is the underlying cause of bug #1).

## Code-quality cleanup (low-risk, recommended)

### 6. Remove or tighten `as any` casts (90 occurrences)

Highest-impact files:

- `src/routes/api/public/payments/webhook.ts` — ~15 `(quote as any).field` accesses. Generate a narrow `type WebhookQuote = Pick<Database['public']['Tables']['quotes']['Row'], ...>` once, cast `quote as WebhookQuote` at the top, drop the per-field casts.
- `src/routes/messages.tsx` — `useState<any[]>` for `messages` and `requests`. Replace with row types from `Database['public']['Tables']['quote_messages'|'quote_requests']['Row']`.
- `src/lib/portal-pdf.ts:208-209`, `src/routes/invoices.$quoteId.tsx:137` — same pattern, narrow the `LineItem` type to include `unit?: "hours" | "days" | string` so the per-call cast is gone.

Leave intentional ones (`navigator.standalone`, web-push subscription JSON shape) with a one-line type assertion + comment.

### 7. Strip `// @ts-ignore` in `src/lib/pdf.ts:138`

`(doc as any).lastAutoTable.finalY` works without the ignore — the `as any` already silences the missing property. Delete the ignore line and keep the cast.

### 8. Console noise audit

~55 `console.log/error/warn` calls across server fns and routes. Keep server-side `console.error` (Cloudflare logs), but remove or gate dev-only `console.log` in:

- `src/routes/quotes.new.tsx` (8 calls)
- `src/routes/quotes.$quoteId.tsx` (4 calls)
- `src/routes/api/public/payments/webhook.ts` (9 — keep `console.error`, drop `console.log` traces)
- `src/lib/user-data.ts` (10 — most look like debugging)

Rule of thumb: keep `console.error` in catch blocks; remove standalone `console.log`.

### 9. Supabase linter

One WARN: `Extension in Public`. Low priority, security-only nit. Out of scope unless you want me to also move the extension to its own schema (DB migration).

## Out of scope (flagging only, not changing)

- The `/request/$proId` auth-gate question (already deferred in the previous plan).
- The `quote_requests` row type: types are auto-generated, so #6 just consumes them — no schema change.
- Skill/agent files, marketing copy, design tokens — no changes.

## Files touched if approved

- `src/routes/quotes.new.tsx` — `validateSearch` + read `prefill` once.
- `src/routes/messages.tsx` — invalidate inbox count, drop `as any` on search, mounted-guard in effect, typed state.
- `src/components/BottomNav.tsx` — gate query on session.
- `src/lib/pdf.ts` — drop `@ts-ignore`.
- `src/routes/api/public/payments/webhook.ts` — single typed cast, drop log noise.
- `src/lib/portal-pdf.ts`, `src/routes/invoices.$quoteId.tsx` — narrow `LineItem` casts.
- `src/lib/user-data.ts`, `src/routes/quotes.new.tsx`, `src/routes/quotes.$quoteId.tsx` — strip debug `console.log`.

## Suggested order

1. Bugs 1-4 (user-visible behavior).
2. Bug 5 (prevents the same class of bug recurring).
3. Cleanup 6-8 in one pass.
4. Lint warning 9 only if you want it now.

Want me to proceed with all of the above, or just the bugs (1-5) and skip the cleanup? 

&nbsp;

Proceed with all and test after each one.
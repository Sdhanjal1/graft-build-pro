# Make the inbox reachable + measurable

Scope: nav visibility, unread badge, count on inbox, minor copy tidy. No new logic, no AI, no DB changes.

## 1. BottomNav — swap icon + add unread dot

`src/components/BottomNav.tsx` already has the Inbox item between Quotes and Chasers, but uses `MessageSquare`. Two changes:

- Swap import + icon to `Inbox` from `lucide-react`.
- Add an unread dot on the Inbox item only.

Data fetching: app uses TanStack Query (`tanstack-query-integration` is the canonical pattern, `QueryClient` is already in router context). Add `useQuery` inside `BottomNav` calling `getMyIncomingRequests` via `useServerFn`:
- `queryKey: ["inbox-unread-count"]`
- `queryFn` → returns the raw response
- `refetchInterval: 30_000`
- `refetchOnWindowFocus: true`
- `staleTime: 15_000`
- `select: (r) => r.requests.filter((x) => !x.read_at).length`
- Wrap in try/catch in `select` if needed; on error / loading → treat as `0`, show no dot (fail silent).

Skip the query entirely on routes where the nav is already hidden (the `hide` branch returns early before `useQuery`, which would break the rules of hooks — instead always run the query but guard with `enabled: !hide`).

Pass `unread: count > 0` to the Inbox `NavItem`. Extend `NavItem` props with optional `unread?: boolean`. Render the dot inside the existing `<span>` wrapper so it tracks with the icon:

```tsx
{unread && (
  <span aria-hidden className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-lime ring-2 ring-ink" />
)}
```

Position requires `relative` on the icon's wrapper — the inner pill `<span>` is already a flex item; add `relative` to it so the dot anchors to the icon area not the whole `<Link>` (the `<Link>` is already `relative`, but anchoring to that would offset by the active label width).

Accessibility: when `unread`, swap the `sr-only` label from `Inbox` to `Inbox, unread requests`.

## 2. Spacing check on 360px

At 360px with 5 items, only the active label renders ("Chasers" is the longest at 7 chars + icon). The pill is `max-w-md` capped and each item is `flex-1`, so even active Chasers fits. No change unless visual check shows clipping; if so, drop active label from `text-[12px]` to `text-[11px]` — nothing else.

## 3. Inbox screen — total count in header

`src/routes/messages.tsx` currently shows `PageHeader title="Inbox" subtitle="Requests and chats"` and a `{newRequests.length} new` chip next to the Quote requests section.

Add a compact count under the page title showing total requests received and unread split. Replace the `subtitle` prop with a dynamic one:

- `subtitle={\`${requests.length} request${requests.length === 1 ? "" : "s"}${newRequests.length ? ` · ${newRequests.length} new\` : ""}\``}

If `PageHeader`'s subtitle styling doesn't allow a Bebas Neue numeral, leave it as plain subtitle text — the spec says minimal and on-brand; the existing subtitle style is on-brand. No new component, no header surgery. Keep the existing "X new" chip beside the section header as-is.

## 4. Customer request form — verify only

`src/routes/request.$proId.tsx`:

- Business name is already shown in `<Header>` and in the H1 ("Send a request to {business_name}"). No change.
- Voice/text already a toggle pair with equal weight; lime submit button is primary. No change.
- Success state already renders a tick + "Request sent" + business-name message, with a manual "Done" link (no auto-redirect). No change.
- **Conflict to flag**: spec says "Confirm the form still works for a logged-out customer (this route must be public — no auth gate)". The route is publicly reachable, but the form requires sign-in: when `!session`, the route renders `<CustomerAuth />` and forces signup/login before send. `createQuoteRequest` is also `.middleware([requireSupabaseAuth])`. Truly removing the auth gate means:
  - Changing the server fn to drop `requireSupabaseAuth` and accept anonymous submissions (likely using `supabaseAdmin` server-side).
  - Adjusting RLS / GRANTs on `quote_requests` for anonymous inserts.
  - Likely adding bot-protection (rate limit / honeypot) since the endpoint becomes public.
  
  That is a backend + security change, not the navigation/visibility scope this prompt describes. **Plan: leave the auth-required behaviour exactly as-is in this PR.** If you want truly public submissions, I'll do that as a separate plan.

## 5. Portal CTA — verify only

`src/routes/portal.c.$code.tsx` around line 472. Open it, confirm:
- The "Request a quote" button uses lime primary styling and reads clearly.
- It links to `/request/$proId` with the correct `proId` param from the loaded data.

If both true → no change. If styling is muted or proId wiring is wrong → fix in place (lime treatment, correct param) without touching anything else on the portal.

## Out of scope
No analytics SDK, no DB changes, no notification changes, no AI handling, no auth changes to the public request form (see §4).

## Acceptance
1. Inbox icon (lucide `Inbox`) sits between Quotes and Chasers.
2. Tapping opens `/messages`.
3. Unread quote requests → lime dot on Inbox icon; clears on next refetch after the request is marked read.
4. No clipping at 360px.
5. Inbox header shows `N requests · M new`.
6. Portal "Request a quote" CTA verified prominent + correctly wired.

## Files touched
- `src/components/BottomNav.tsx` — icon swap, useQuery, NavItem `unread` prop + dot, sr-only label tweak.
- `src/routes/messages.tsx` — subtitle change only.
- `src/routes/portal.c.$code.tsx` — only if §5 check fails.

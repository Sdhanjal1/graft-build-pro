Additional notes - 1. (Fix 2 — the one to get right) Handle the already-hydrated case on mount. The risk with adding a loading flag is the mirror of the flash: on warm navigation (store already populated), you don’t want a skeleton flashing over data that’s already there, and you definitely don’t want it stuck on loading: true if the version listener doesn’t re-fire. Initialize the flag from whether the store is already hydrated — something like useState(() => !storeAlreadyHydrated) — so a warm load renders instantly and only a genuine cold load shows the skeleton. Tell Lovable to confirm both cold and warm loads behave.

2. (Fix 1 UI) Verify the “Set up payments” link actually hits the working onboarding flow. The plan says “re-use whatever Settings uses.” Make sure it resolves to the real Connect start-onboarding trigger, not a placeholder or dead link — glance at the diff to confirm the target is the same action that works from Settings.

3. (Fix 1 backend) Confirm the thrown error surfaces gracefully. Since the backend throw is a backstop behind the UI gate, make sure the “Request payment” dialog catches it and shows the message rather than throwing an unhandled rejection. Low risk because the buttons are disabled, but worth a line so the edge case fails cleanly.

Everything else — the reuse-branch guard, the skeleton mirroring of messages, the not-found back links, the acceptance criteria — is right. Add those three notes, run it, then point me at the repo and I’ll verify all three landed before you move o

&nbsp;

&nbsp;

&nbsp;

# Launch gap fixes

Three scoped fixes. The connected-account charge path, 0.5% fee, webhooks, AI/voice, and messages loading state are untouched.

## 1. Payment gating (money-critical)

**Backend — `src/lib/payments.functions.ts**`

- `createInvoiceCheckout` (~line 89): right after `connectAccountId` is computed, if it's `null`, throw `"Set up payments before you can take payment — finish connecting your bank in Settings."` and return before any Stripe API call. Existing connected-account branch (Stripe-Account header + `application_fee_amount`) is unchanged.
- Public payment-link function (~line 304, same `charges_enabled && account_id` pattern used for the portal token flow): same guard immediately after `connectAccountId` is computed, throwing a customer-appropriate message: `"This business hasn't finished setting up payments yet."`. Also apply to the reuse-pending branch at ~line 270 so a previously created session isn't returned when onboarding has since lapsed.

**UI — `src/routes/quotes.$quoteId.tsx**`

- Import and call `useConnectStatus()`.
- When `!chargesEnabled` (and not loading), gate the "Request payment (send link)" (line 834) and "Take payment on site" (line 837) actions: disable both and render a small inline prompt "Set up payments first" that links to the existing Connect onboarding entry point used in Settings (re-use whatever Settings uses — `connect.functions.ts` start flow or the Settings billing section trigger).
- While `loading` from the hook is true, keep the buttons disabled to avoid a flash of enabled→disabled.

## 2. Empty-state flash — Chasers and Clients

Mirror the pattern `src/routes/messages.tsx` uses.

- `src/routes/chaser.tsx` and `src/routes/clients.index.tsx`: add a `loading` flag (default `true`), subscribe to the existing store version listener in `src/lib/user-data.ts` (same one `messages.tsx` uses), flip `loading` to `false` on first hydration.
- While loading, render the same `SkeletonCard` pattern from messages (reuse `src/components/Skeletons.tsx`) — a short stack of skeleton rows matching the list layout.
- Only render `EmptyState` when `!loading && list.length === 0`.

## 3. Not-found back link

Replace bare "not found" text in the two `notFoundComponent`s with a centered card containing the message + a "Back to quotes" button linking to `/quotes`, using the existing button styles already used elsewhere (lime pill `bg-lime text-ink rounded-full px-5 py-2.5 text-xs font-bold` to match `EmptyState`'s CTA).

- `src/routes/quotes.$quoteId.tsx` line 59
- `src/routes/invoices.$quoteId.tsx` line 20

## Acceptance

- Non-onboarded trader: both payment buttons in quote detail are disabled with onboarding prompt; if somehow invoked, backend throws clear error — no charge reaches the platform account.
- Onboarded trader: unchanged flow, funds route to connected account, 0.5% fee applied.
- Chasers/Clients: cold load shows skeleton, no empty flash; truly empty state shows EmptyState after hydration.
- `/quotes/{missing}` and `/invoices/{missing}`: friendly message + working back link to `/quotes`.
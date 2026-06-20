# Verify Stripe Connect client id matches live platform key

## Goal

Confirm `STRIPE_CONNECT_CLIENT_ID` belongs to the **same** Stripe platform account (and same mode) as `STRIPE_BYOK_SECRET_KEY` (live). A mismatch means OAuth-connected sub-accounts land on the wrong platform and Connect calls silently fail or 404.

## Why not just inspect the value

Stripe Connect client ids look like `ca_…` in **both** live and sandbox — the prefix doesn't disambiguate. The only reliable check is to ask Stripe.

## Approach — probe via Stripe's OAuth deauthorize endpoint

Stripe's OAuth endpoints return distinct errors that let us distinguish "wrong client id / wrong mode" from "right client id, wrong account argument":

- `POST https://connect.stripe.com/oauth/deauthorize` with `client_id=<STRIPE_CONNECT_CLIENT_ID>` and `stripe_user_id=acct_invalid_probe` using the live secret as `Authorization: Bearer`.
  - **Match (live id + live key)** → `400 invalid_request` with message like *"The account specified … does not exist or you do not have access to it"*. Confirms the client id is recognised on the live platform.
  - **Mismatch (sandbox id + live key, or unknown id)** → `401 invalid_client` / *"No such application"*. Confirms the id does NOT belong to the live platform.
  - Network/other error → report verbatim, don't draw a conclusion.

No state changes — deauthorize on a non-existent account is a no-op.

## Implementation

Add a small admin-only server function `verifyConnectClientId` in `src/lib/ops.functions.ts`:

1. `.middleware([requireSupabaseAuth])` + `has_role(userId, 'admin')` gate (matches other ops fns).
2. Read `STRIPE_BYOK_SECRET_KEY` and `STRIPE_CONNECT_CLIENT_ID` inside handler.
3. `fetch` the deauthorize endpoint with the probe account id.
4. Return `{ mode: 'live' | 'sandbox' | 'unknown', detail: <stripe message> }` based on the response body.

Expose a "Verify Connect client id" button in the existing Ops route (`src/routes/ops.tsx`) that calls it and shows the result inline. No UI for end users.

## Files touched

- `src/lib/ops.functions.ts` — new `verifyConnectClientId` server fn.
- `src/routes/ops.tsx` — small button + result panel.

## Out of scope

- Rotating or replacing the client id (manual Stripe dashboard step if mismatched).
- Verifying the webhook signing secret env — already separate (`STRIPE_CONNECT_WEBHOOK_SECRET`).
- Any change to the Connect OAuth flow itself.

## What I'll tell you after running it

Either: *"Live match — client id is on the live platform"*, or *"Mismatch — Stripe says No such application, update `STRIPE_CONNECT_CLIENT_ID` to your live `ca_…` from Stripe → Settings → Connect → Onboarding options"*.

**Approve and run it.** The note back:

> Approved — good approach, and well-timed since I'm about to connect my own account for the £1 test. Build it and run the probe. If it comes back "mismatch," that would explain/prevent Connect onboarding failures, so I'd rather know now than during the payment test.
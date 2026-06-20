# Switch preview to Stripe test mode (Approach A)

## 1. `getStripeEnv()` change — live is the fail-safe default

Edit `**src/lib/payments.functions.ts**` (lines 11–17) to:

```ts
function getStripeEnv() {
  // Sandbox is opt-in ONLY when the build was produced with the explicit
  // preview flag AND a sandbox key is present. Every other code path —
  // unset flag, unrecognised value, missing sandbox key, production
  // build — falls through to live. Live is the fail-safe default; we
  // never silently route real customers to test keys.
  const flag = import.meta.env.VITE_PAYMENTS_MODE;
  const sandboxKey = process.env.STRIPE_SANDBOX_API_KEY;
  if (flag === "sandbox" && sandboxKey) {
    return { key: sandboxKey, env: "sandbox" as const };
  }
  const liveKey =
    process.env.STRIPE_BYOK_SECRET_KEY ?? process.env.STRIPE_LIVE_API_KEY;
  if (!liveKey) throw new Error("Stripe is not configured");
  return { key: liveKey, env: "live" as const };
}
```

Truth table — confirm before applying:


| `VITE_PAYMENTS_MODE`        | sandbox key | live key | Returns                             |
| --------------------------- | ----------- | -------- | ----------------------------------- |
| `"sandbox"`                 | ✅           | any      | **sandbox**                         |
| `"sandbox"`                 | ❌           | ✅        | **live** (fail-safe)                |
| `"live"`                    | any         | ✅        | **live**                            |
| unset                       | any         | ✅        | **live**                            |
| `"prod"`, `"test"`, garbage | any         | ✅        | **live**                            |
| anything                    | any         | ❌        | throws (no silent sandbox fallback) |


Sandbox requires **two** affirmative conditions; everything else is live.

Set `VITE_PAYMENTS_MODE=sandbox` in `**.env.development**` only. Production builds read no value → live. This is a build-time inline (Vite), so the bundled value is frozen per build — preview deployment will be sandbox, published deployment will be live, regardless of runtime env mutations.

No other files change in this batch.

## 2. Test-mode Connect account — does not exist yet

Confirmed by reading `src/lib/connect.functions.ts`: Connect uses **Standard** accounts created via Stripe's hosted onboarding (`/accounts` + `/account_links` with `type=account_onboarding`). The account ID is stored on `profiles.stripe_connect_account_id`. Live and test mode are separate Stripe namespaces — any `acct_…` you have today was minted under the live BYOK key and is invalid under sandbox keys.

**Steps to create one (after this batch lands and preview is on sandbox keys):**

1. In the preview app, sign in as a throwaway test user (or seed one).
2. Go to the Connect onboarding entry point in Settings — the existing UI calls `createConnectAccountLink` / similar from `connect.functions.ts`. Because the preview now reads sandbox keys, this hits Stripe **test mode** and writes a test-mode `acct_…` to that user's `profiles.stripe_connect_account_id`.
3. Complete Stripe's hosted onboarding using test values: SSN `000-00-0000`, DOB `01/01/1901`, address `address_full_match`, routing `110000000`, account `000123456789`, phone `0000000000`. These auto-approve and flip `charges_enabled=true` immediately.
4. On return, the app calls the existing capability-refresh path which writes `stripe_connect_charges_enabled=true`.
5. Use that user's UUID as `--user` for `scripts/lifecycle-deposit.ts`.

No code changes needed for step 2 — the existing Connect flow works under sandbox keys automatically once `getStripeEnv()` returns sandbox.

## 3. `PAYMENTS_WEBHOOK_SECRET` → `PAYMENTS_LIVE_WEBHOOK_SECRET` rename — deferred

**Total references in the repo: exactly one.**

```
src/routes/api/public/payments/webhook.ts:10
  if (env === "live") return process.env.PAYMENTS_WEBHOOK_SECRET;
```

That's the only occurrence in `src/`, `supabase/`, route files, or anywhere else searched. `PAYMENTS_SANDBOX_WEBHOOK_SECRET` is referenced on the next line and is correct. The Lovable-managed secret store already has `PAYMENTS_LIVE_WEBHOOK_SECRET` populated and `PAYMENTS_WEBHOOK_SECRET` does **not** exist — so today's live webhook verification fails closed (returns 401 invalid signature, or never runs because the secret is undefined and the code drops with 200). Either way, no production traffic depends on the misnamed var; the rename strictly fixes the bug.

When you greenlight the separate commit, the change is a one-line edit:

```ts
if (env === "live") return process.env.PAYMENTS_LIVE_WEBHOOK_SECRET;
```

No env-var add/delete needed (the correctly-named secret is already present). No staged rollout required because there is no working live webhook path to break.

**Not touching this in the current batch.**

## What I am NOT changing in this batch

- `webhook.ts` (rename deferred)
- Connect onboarding code (works as-is once keys flip)
- Production env, secrets, or Stripe dashboard
- The lifecycle script

&nbsp;

Apply the `getStripeEnv()` change as written — truth table confirmed, live is the fail-safe default. Then, as a **separate immediate commit** (not deferred, not bundled): the `PAYMENTS_WEBHOOK_SECRET → PAYMENTS_LIVE_WEBHOOK_SECRET` one-line fix. Reason: your analysis shows the live webhook has never verified — that's a launch blocker hiding behind a "typo," and I want it fixed now while we understand it, not rediscovered on go-live.

After both land: I'll confirm the preview build is actually hitting Stripe test mode (verify the env call uses the sandbox key) **before** running Connect onboarding — I don't want those test-identity values going to a live account if the flag didn't take. Then create the test Connect account per your steps and run the lifecycle script.
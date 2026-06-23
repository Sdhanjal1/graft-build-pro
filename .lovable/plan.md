**Goal**
Fix the Add payment method flow so the Stripe checkout server function accepts the actual preview/project return origin instead of throwing `Return URL origin not allowed`.

**Plan**
1. Update the return URL allowlist used by subscription checkout to include the currently rejected project origin:
   - `https://e4be6907-c837-4e5e-9461-63fadfdad91e.lovableproject.com`
2. Apply the same allowlist update to invoice/payment checkout validation so the same domain does not fail elsewhere.
3. Keep the existing protection against open redirects: only known Quottr, published, preview, localhost, and project origins will be accepted.
4. Verify by re-running the Add payment method path and confirming the error moves past URL validation instead of showing `Return URL origin not allowed`.

**Technical detail**
The failing URL comes from `window.location.origin` in `BillingSection.tsx`; the server validates it in `assertAllowedReturnUrl()` inside `src/lib/subscription.functions.ts`. The current allowlist includes the `.lovable.app` preview URL but not the `.lovableproject.com` runtime origin, which is why this specific preview environment is rejected.
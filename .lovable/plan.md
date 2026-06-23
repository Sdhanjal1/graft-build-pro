# Switch to live Stripe

Stripe go-live is already complete:

- Sandbox claimed ✓
- Live account onboarding submitted ✓
- Lovable app installed on live account ✓
- Live API keys provisioned ✓
- Readiness check passed ✓

The live publishable token (`pk_live_...`) is already written to `.env.production`. The preview always runs the sandbox token (`pk_test_...`) by design, so the only remaining step is to publish so the live build goes out to your custom domains (quottr.co.uk, graft-build-pro.lovable.app).

## Plan

1. **Publish the app** so the production bundle picks up `VITE_PAYMENTS_CLIENT_TOKEN` from `.env.production` and live checkout activates on your published URLs.
2. **Verify after publish**: load the published site (not the preview), open a checkout flow, and confirm the test-mode orange banner is gone — that confirms the live token is in use.

No code changes. The preview will continue to use test mode (cards `4242 4242 4242 4242` etc.); only the published site will charge real cards.

what does publish mean ?
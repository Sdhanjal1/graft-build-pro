## Goal

Verify the push-notification pipeline end-to-end — registration, subscription save, server-side send, and delivery — without changing any logic.

## What I'll check (read-only)

1. **Config sanity**
  - `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` secrets present (already shown in context — both set).
  - `getVapidPublicKey` server fn returns a non-empty key (call via stack_modern--invoke-server-function).
  - `public/sw.js` registered correctly via `src/lib/sw-register.ts`; confirm `push` and `notificationclick` handlers exist (already confirmed in code).
2. **Database state**
  - `push_subscriptions` table: row count, schema, RLS, and any rows for the current signed-in user (Sundeep). Run via `supabase--read_query`.
3. **Client subscribe flow** (Playwright against localhost)
  - Open the app authenticated (using `LOVABLE_BROWSER_SUPABASE_*` env).
  - Navigate to the page that renders `CustomerQRCard` (the only subscribe surface today).
  - Grant notifications permission via `context.grant_permissions(["notifications"])`.
  - Click the enable-notifications control; screenshot result; confirm a new row lands in `push_subscriptions`.
4. **Server send**
  - Call `sendTestPush` via `stack_modern--invoke-server-function` (uses the preview user's bearer).
  - Inspect `stack_modern--server-function-logs` for `[push]` errors or `web-push` non-2xx responses.
  - Confirm the browser receives the notification (Playwright `page.on("notification")` isn't a thing for service-worker notifications, so I'll instead listen via `navigator.serviceWorker` messages or check `registration.getNotifications()` after a short wait, and screenshot).
5. **Dead-subscription cleanup path**
  - Confirm via code review that 404/410 deletion is wired (already done — `push.server.ts` L16-27). No runtime test needed unless step 4 fails.
6. **Call-site coverage** (read-only — just report which user events currently fire `notifyUser` so you know what's covered):
  - `messages.functions.ts`, `quote-requests.functions.ts`, `portal.functions.ts`, `payments-webhook-shared.server.ts`, `api/public/hooks/service-reminders.ts`.

## Out of scope

No code changes. If something is broken I'll report findings and propose a fix as a separate plan.

## Deliverable

A short report: ✅/❌ for each step above, with the test-push outcome (delivered / failed + reason), current subscription count for your account, and any log errors.

## One question before I run this

The only place a user can currently subscribe to push is `CustomerQRCard` — is that intentional? If you've already enabled push on your account in this browser I can skip the subscribe step and go straight to `sendTestPush`. Otherwise I'll drive Playwright through the subscribe UI first.

push notifcation is enable in settings keep as is i just want to make sure it fires as we have set it throughout the process
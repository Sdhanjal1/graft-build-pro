## Why it bounces

`/ops/stack` `beforeLoad` calls `getIsAdmin`, which runs the DB function `public.is_admin(_uid)` against `profiles.is_admin`. For your account that flag is `false`, so the gate redirects to `/app`. The stack page itself is fine.

## Fix

One-line migration to flip your profile to admin:

```sql
UPDATE public.profiles
SET is_admin = true
WHERE email = 'sundeepdhanjal@hotmail.com';
```

After that, sign out and back in (or just refresh), then `/ops/stack` will load with live probes for Anthropic, OpenAI, Lovable AI Gateway, Stripe, Resend, VAPID, and Supabase.

## Not included

- No code changes — gate logic is already correct.
- No change to other users' admin status.
- No new admin-management UI (can add later if you want a toggle instead of SQL).

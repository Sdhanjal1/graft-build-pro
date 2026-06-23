## Problem

Logo upload to the `branding` bucket fails with `new row violates row-level security policy` (403). The upload path (`<uid>/logo-<ts>.<ext>`) and client code are correct — the user is signed in, and `auth.uid()` matches the first folder segment.

The storage policies on `branding` are incomplete:

```
Users upload own branding  INSERT  public  -- WITH CHECK auth.uid() = foldername[1]
Users update own branding  UPDATE  public  -- USING   auth.uid() = foldername[1]
Users delete own branding  DELETE  public  -- USING   auth.uid() = foldername[1]
```

There is **no SELECT policy** on `branding`. The upload uses `upsert: true`, which makes supabase-storage check whether the object already exists before deciding INSERT vs UPDATE — that pre-check needs SELECT. Without it, the upsert path fails RLS even on a brand-new file. (The bucket being "public" only exposes object bytes through the public URL CDN; it does not grant SQL-level SELECT on `storage.objects`.)

The existing policies are also bound to role `public` instead of `authenticated`, which is harmless but inconsistent with the rest of the project.

## Fix

One migration on `storage.objects` that:

1. Drops the three existing `branding` policies.
2. Recreates them bound to `authenticated`, scoped to `auth.uid()::text = (storage.foldername(name))[1]`.
3. Adds a matching **SELECT** policy for `authenticated` so `upsert` works and the owner can list/read their own logo through the SDK.
4. Adds a public `SELECT` policy so anyone can read logos via the public URL (the bucket is already public — this just makes it explicit at the RLS layer and removes any ambiguity for future readers).

No code change in `src/routes/settings.tsx` is needed — the upload flow is correct; only the policy set is wrong.

## Verification

After the migration, retrying the same PNG should log:

```text
[logo] uploading → branding/<uid>/logo-<ts>.png
[logo] uploaded ok
[logo] public url https://…/storage/v1/object/public/branding/<uid>/logo-…png
[logo] done
```

and show a "Logo updated" toast — no more 403.

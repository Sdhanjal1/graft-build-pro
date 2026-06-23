## Problem

You picked a 2.17 MB PNG (`Untitled design (1).png`). It passes every validation rule, so the code reaches `supabase.storage.from("branding").upload(...)`. The network log confirms **no** storage request was sent — the upload promise is stalling client-side before it ever fires a fetch (most likely a known supabase-js v2 quirk when `File.type` is empty or when the storage client hasn't finished initializing). The existing 30s timeout only wraps the upload call itself; if the call never resolves and never rejects, `finally` still runs after 30s — but you said "nothing happens", which means either you didn't wait that long, or the error toast was hidden.

Either way the UX is broken: no progress, no error, just a stuck "Uploading…" button.

## Fix

Tighten the upload flow in `src/routes/settings.tsx → handleLogoFile`:

1. **Force a clean MIME + filename before upload.** Build a fresh `File` from the picked file's bytes with an explicit `type` (`image/png` / `image/jpeg` / `image/webp`) and a safe ASCII filename (strip spaces, parens, non-`[a-z0-9._-]`). This kills the "File.type is empty" path that can stall supabase-js, and avoids any chance of the bucket path containing odd characters.

2. **Lower the upload timeout to 20 s and surface the failure clearly.** If the upload doesn't settle in 20 s, reject with `"Upload didn't respond — try again"` so the toast actually appears instead of looking frozen.

3. **Add a hard outer safety timeout (45 s) around the whole handler.** Whatever happens — HEIC conversion stuck, storage promise stuck, anything — `setUploading(false)` always runs and a toast always shows.

4. **Verbose `[logo]` logging at each step** (`picked → validated → converted → uploading → uploaded → public url → done`) so if it still fails on your next attempt, the console tells us exactly which step stalled.

5. **Don't blank `logo_url` on accidental autosave.** Right now the autosave can fire mid-upload and POST `logo_url: null` (visible in your network log). Skip the autosave for `logo_url` while `uploading === true` so the upload's own `saveProfile({ logo_url })` is the only writer.

No schema or RLS changes — bucket + policies are already correct.

## Files

- `src/routes/settings.tsx` — rewrite `handleLogoFile` per the 5 points above; gate the logo field in the autosave effect on `!uploading`.

## Verification

After the change, retry the upload with the same PNG. Expected console trace:

```text
[logo] picked {name, type, size}
[logo] normalized {name: "logo-…png", type: "image/png", size}
[logo] uploading → branding/<uid>/logo-<ts>.png
[logo] uploaded ok
[logo] public url https://…/branding/<uid>/logo-…png
[logo] done
```

And a "Logo updated" toast. If anything stalls, you'll get a "Couldn't upload logo: …" toast within 45 s and the button returns to "Add your logo" — no more silent hang.

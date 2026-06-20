## Why the logo upload silently does nothing — and how to fix it

### What I checked

- `branding` storage bucket exists and is public; INSERT/UPDATE/DELETE RLS policies on `storage.objects` are correctly scoped (`auth.uid()::text = first folder segment`) and apply to authenticated users.
- `storage.objects` where `bucket_id='branding'` → **0 rows**. No file has ever been uploaded by anyone.
- `public.profiles` where `logo_url is not null` → **0 rows**.
- Settings click handler (`fileInputRef.current?.click()`) and `<input type=file accept="image/png,image/jpeg">` are wired correctly.
- `handleLogoFile` (`src/routes/settings.tsx:194`) does an early-return on file type/size/offline, sets `uploading=true`, calls `supabase.storage.from('branding').upload(...)`, then `saveProfile({ logo_url })`.

User reports: file picker opens, file chosen, then **no spinner ("Uploading…") and no toast** — i.e. `handleLogoFile` either returns silently before `setUploading(true)`, or its early-return toasts never render.

### Most likely cause

The early-return type check is too strict:

```ts
if (!/^image\/(png|jpeg|jpg)$/i.test(file.type)) { toast.error("Use a PNG or JPG image"); return; }
```

On iOS Safari and some Android browsers, `File.type` is **empty (`""`)** for camera-roll images or when the OS can't infer a MIME — especially HEIC/HEIF from iPhone. The regex fails → function returns immediately. If the toast viewport is off-screen (settings is a long scroll) the user genuinely sees nothing happen.

Zero files ever uploaded across all users is consistent with the check rejecting many real-world picks.

### Fix (frontend only — no DB or storage changes needed)

In `src/routes/settings.tsx` `handleLogoFile`:

1. **Validate by extension when MIME is empty/unknown**, and explicitly reject HEIC with a useful message:
  - Accept if `file.type` is `image/png|jpeg|jpg|webp`, OR if `file.type` is empty and the filename ends in `.png/.jpg/.jpeg/.webp`.
  - If the extension is `.heic`/`.heif` (iPhone default), toast: "iPhone HEIC photos aren't supported — choose 'Most Compatible' in iPhone Camera settings, or pick a PNG/JPG."
  - Add `webp` to the accept list (it's universal now) and update the `<input accept="...">` to match.
2. **Surface real errors** instead of the generic catch-all:
  - In the `catch`, include `err.message` in the toast (e.g. "Couldn't upload logo: &nbsp;"), and `console.error` with full context.
  - Add a `console.info("[logo] picked", { name, type, size })` at the top so we can see what the browser handed us if the user retries.
3. **Make the upload feedback visible immediately**: set `uploading=true` *before* the validation early-returns return (or move the picker button so the "Uploading…" / error state is in view) — actually simpler: render any rejected-file toast with `duration: 6000` and `richColors` so it's hard to miss.
4. **Reset the hidden input on the same render** (already done) — keep as-is.

### Out of scope

- No changes to `branding` bucket, RLS, profile schema, or `saveProfileToCloud`. The DB-side path is correct; the upload never reaches it.

### Verification

After the fix, retry from the user's device. If it's still silent, the new `console.info` line will show exactly what the browser sees (`type`, `size`) and the catch-block toast will display the real error from Supabase Storage. That tells us in one round-trip whether to dig further (e.g. session/auth, bucket policy edge case) or close the issue.

Approved — great diagnosis, and the "zero files ever uploaded" data point confirms it. One addition: rather than only rejecting HEIC with a message, consider **converting HEIC to JPEG client-side** (e.g. heic2any or a canvas-based conversion) so iPhone photos just work without the user changing settings — since most of our users are on iPhone and a logo upload should be effortless. If client-side HEIC conversion is too heavy/unreliable, then keep the clear rejection message as the fallback. Either way, ship the rest as planned (extension-based validation, webp support, real error surfacing, console logging).

Also — confirm the rejection/error toasts are actually *visible*: since settings is a long scroll and the logo field is near the top, make sure a toast shows where the user will see it (the plan's `duration: 6000` + richColors helps, but confirm toasts render in a fixed/visible position, not scrolled off).
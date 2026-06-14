
-- Remove duplicate public-role storage policies on client-docs (authenticated-scoped equivalents already exist)
DROP POLICY IF EXISTS "Owners upload client docs" ON storage.objects;
DROP POLICY IF EXISTS "Owners update client docs" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete client docs" ON storage.objects;

-- Tighten merch_interest INSERT policy: prevent spoofing user_id, require non-empty email
DROP POLICY IF EXISTS "Anyone can register interest" ON public.merch_interest;
CREATE POLICY "Anyone can register interest"
ON public.merch_interest
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND length(email) BETWEEN 3 AND 320
);

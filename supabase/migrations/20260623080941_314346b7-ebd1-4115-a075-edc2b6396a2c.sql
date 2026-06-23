
DROP POLICY IF EXISTS "Users upload own branding" ON storage.objects;
DROP POLICY IF EXISTS "Users update own branding" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own branding" ON storage.objects;
DROP POLICY IF EXISTS "Users read own branding" ON storage.objects;
DROP POLICY IF EXISTS "Public read branding" ON storage.objects;

CREATE POLICY "Users upload own branding"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own branding"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'branding' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own branding"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own branding"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'branding' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read branding"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'branding');

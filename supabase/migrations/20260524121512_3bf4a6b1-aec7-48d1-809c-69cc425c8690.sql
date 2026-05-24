
UPDATE storage.buckets SET public = false WHERE id = 'client-docs';

DROP POLICY IF EXISTS "Pros read own client-docs" ON storage.objects;
DROP POLICY IF EXISTS "Pros insert own client-docs" ON storage.objects;
DROP POLICY IF EXISTS "Pros update own client-docs" ON storage.objects;
DROP POLICY IF EXISTS "Pros delete own client-docs" ON storage.objects;

CREATE POLICY "Pros read own client-docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'client-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Pros insert own client-docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'client-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Pros update own client-docs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'client-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Pros delete own client-docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'client-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

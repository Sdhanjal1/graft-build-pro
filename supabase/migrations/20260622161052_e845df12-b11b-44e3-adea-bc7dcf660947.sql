CREATE POLICY "Public read access to branding bucket"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'branding');
CREATE POLICY "Users delete own working hours"
ON public.working_hours
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users read own client docs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-docs'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Branding columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS quote_intro TEXT,
  ADD COLUMN IF NOT EXISTS quote_footer TEXT,
  ADD COLUMN IF NOT EXISTS signature_name TEXT,
  ADD COLUMN IF NOT EXISTS show_signature BOOLEAN NOT NULL DEFAULT true;

-- Public storage bucket for business logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read (logos are shown on shared quote/portal pages)
CREATE POLICY "Branding assets are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding');

-- Users can upload/update/delete their own logo files (stored under their uid/ prefix)
CREATE POLICY "Users upload own branding"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'branding' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own branding"
ON storage.objects FOR UPDATE
USING (bucket_id = 'branding' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own branding"
ON storage.objects FOR DELETE
USING (bucket_id = 'branding' AND auth.uid()::text = (storage.foldername(name))[1]);

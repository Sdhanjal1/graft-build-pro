
-- 1. Random 12-char alphanumeric portal code generator
CREATE OR REPLACE FUNCTION public.generate_portal_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..12 LOOP
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- 2. Add columns to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS portal_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS portal_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS service_due_date date,
  ADD COLUMN IF NOT EXISTS service_type text;

-- 3. Trigger to set portal_code on insert
CREATE OR REPLACE FUNCTION public.set_client_portal_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate text;
  attempts int := 0;
BEGIN
  IF NEW.portal_code IS NULL OR NEW.portal_code = '' THEN
    LOOP
      candidate := public.generate_portal_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clients WHERE portal_code = candidate);
      attempts := attempts + 1;
      IF attempts > 10 THEN
        RAISE EXCEPTION 'Could not generate unique portal code';
      END IF;
    END LOOP;
    NEW.portal_code := candidate;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_client_portal_code ON public.clients;
CREATE TRIGGER trg_set_client_portal_code
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.set_client_portal_code();

-- 4. Backfill existing clients
DO $$
DECLARE
  r record;
  candidate text;
BEGIN
  FOR r IN SELECT id FROM public.clients WHERE portal_code IS NULL LOOP
    LOOP
      candidate := public.generate_portal_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clients WHERE portal_code = candidate);
    END LOOP;
    UPDATE public.clients SET portal_code = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- 5. Quotes: portal_visible flag
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS portal_visible boolean NOT NULL DEFAULT true;

-- 6. Client documents
CREATE TABLE IF NOT EXISTS public.client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'other',
  file_url text NOT NULL,
  portal_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_documents_client ON public.client_documents(client_id);
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own client documents" ON public.client_documents;
CREATE POLICY "Users manage own client documents"
  ON public.client_documents
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_client_documents_updated_at
  BEFORE UPDATE ON public.client_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Client portal messages (client-wide thread)
CREATE TABLE IF NOT EXISTS public.client_portal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL,
  sender text NOT NULL CHECK (sender IN ('pro','customer','system')),
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_portal_messages_client ON public.client_portal_messages(client_id, created_at);
ALTER TABLE public.client_portal_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own client portal messages" ON public.client_portal_messages;
CREATE POLICY "Users manage own client portal messages"
  ON public.client_portal_messages
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8. Storage bucket for client documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-docs', 'client-docs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read client docs" ON storage.objects;
CREATE POLICY "Public read client docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'client-docs');

DROP POLICY IF EXISTS "Owners upload client docs" ON storage.objects;
CREATE POLICY "Owners upload client docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'client-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Owners update client docs" ON storage.objects;
CREATE POLICY "Owners update client docs"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'client-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Owners delete client docs" ON storage.objects;
CREATE POLICY "Owners delete client docs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'client-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

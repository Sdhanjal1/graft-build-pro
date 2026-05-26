ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accounting_software text,
  ADD COLUMN IF NOT EXISTS accounting_codes jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS town text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS sort_code text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS payment_reference_note text,
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS stripe_publishable_key text,
  ADD COLUMN IF NOT EXISTS stripe_secret_key text;
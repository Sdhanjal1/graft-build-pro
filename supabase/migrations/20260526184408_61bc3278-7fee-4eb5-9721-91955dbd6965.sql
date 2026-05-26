ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS payment_timing text NOT NULL DEFAULT 'on_completion',
  ADD COLUMN IF NOT EXISTS deposit_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_percent numeric NOT NULL DEFAULT 0;

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_payment_timing_check
  CHECK (payment_timing IN ('on_completion','deposit_then_balance','staged','upfront'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_deposit_percent integer NOT NULL DEFAULT 30;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_default_deposit_percent_check
  CHECK (default_deposit_percent BETWEEN 0 AND 100);
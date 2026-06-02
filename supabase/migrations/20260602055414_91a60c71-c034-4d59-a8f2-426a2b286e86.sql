ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS labour_hourly_rate numeric,
  ADD COLUMN IF NOT EXISTS labour_day_rate numeric;
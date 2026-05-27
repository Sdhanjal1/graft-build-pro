ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS materials_purchased boolean[] NOT NULL DEFAULT ARRAY[]::boolean[];
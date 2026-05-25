CREATE TABLE public.user_pricing_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_description text NOT NULL,
  item_category text NOT NULL DEFAULT 'other',
  typical_price numeric NOT NULL DEFAULT 0,
  price_count integer NOT NULL DEFAULT 0,
  price_min numeric NOT NULL DEFAULT 0,
  price_max numeric NOT NULL DEFAULT 0,
  last_quoted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_description)
);

CREATE INDEX idx_user_pricing_patterns_user_count
  ON public.user_pricing_patterns (user_id, price_count DESC);

ALTER TABLE public.user_pricing_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pricing patterns"
  ON public.user_pricing_patterns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own pricing patterns"
  ON public.user_pricing_patterns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own pricing patterns"
  ON public.user_pricing_patterns FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own pricing patterns"
  ON public.user_pricing_patterns FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_user_pricing_patterns_updated_at
  BEFORE UPDATE ON public.user_pricing_patterns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
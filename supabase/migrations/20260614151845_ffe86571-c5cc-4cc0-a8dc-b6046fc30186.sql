CREATE TABLE public.merch_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  product_slug text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.merch_interest TO anon, authenticated;
GRANT ALL ON public.merch_interest TO service_role;

ALTER TABLE public.merch_interest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can register interest"
  ON public.merch_interest
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX merch_interest_created_at_idx ON public.merch_interest (created_at DESC);

-- Admin gate
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

UPDATE public.profiles SET is_admin = true WHERE email = 'sundeepdhanjal@hotmail.com';

CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = _uid), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

-- Platform fee capture
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS platform_fee_cents integer NULL;

-- Error events table (service-role only)
CREATE TABLE IF NOT EXISTS public.error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  context text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.error_events TO service_role;

ALTER TABLE public.error_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS error_events_created_at_idx ON public.error_events (created_at DESC);

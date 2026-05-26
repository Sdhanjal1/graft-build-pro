
-- 1. Bump generated portal code length from 12 to 32 chars
CREATE OR REPLACE FUNCTION public.generate_portal_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..32 LOOP
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN result;
END;
$function$;

-- 2. Track when the portal link was issued (for 90-day expiry)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS portal_issued_at timestamptz NOT NULL DEFAULT now();

-- Backfill existing rows to "now" so existing links remain valid for 90 days from this point
UPDATE public.clients SET portal_issued_at = now() WHERE portal_issued_at IS NULL;

-- 3. Keep portal_issued_at in sync when a new code is assigned via the trigger
CREATE OR REPLACE FUNCTION public.set_client_portal_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
    NEW.portal_issued_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

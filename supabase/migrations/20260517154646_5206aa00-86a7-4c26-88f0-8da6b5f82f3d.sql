-- Add quote workflow columns needed by the app
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS ref text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS paid_via text,
  ADD COLUMN IF NOT EXISTS payment_request jsonb,
  ADD COLUMN IF NOT EXISTS invoiced_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_due_date date;

CREATE INDEX IF NOT EXISTS quotes_user_id_idx ON public.quotes(user_id);
CREATE INDEX IF NOT EXISTS clients_user_id_idx ON public.clients(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS quotes_user_ref_idx ON public.quotes(user_id, ref) WHERE ref IS NOT NULL;

-- Auto-update updated_at on quotes and clients
DROP TRIGGER IF EXISTS quotes_set_updated_at ON public.quotes;
CREATE TRIGGER quotes_set_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS clients_set_updated_at ON public.clients;
CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + handle new user trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
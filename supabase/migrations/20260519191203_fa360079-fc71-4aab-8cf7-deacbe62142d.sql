
CREATE TABLE public.quote_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pro_user_id UUID NOT NULL,
  customer_user_id UUID NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  body TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'text',
  status TEXT NOT NULL DEFAULT 'new',
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pro views own quote requests"
ON public.quote_requests FOR SELECT
USING (auth.uid() = pro_user_id);

CREATE POLICY "Pro updates own quote requests"
ON public.quote_requests FOR UPDATE
USING (auth.uid() = pro_user_id);

CREATE POLICY "Customer views own quote requests"
ON public.quote_requests FOR SELECT
USING (auth.uid() = customer_user_id);

CREATE POLICY "Customer creates quote requests"
ON public.quote_requests FOR INSERT
WITH CHECK (auth.uid() = customer_user_id);

CREATE TRIGGER set_quote_requests_updated_at
BEFORE UPDATE ON public.quote_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.quote_requests;
ALTER TABLE public.quote_requests REPLICA IDENTITY FULL;

-- Public read access to limited profile fields so customers can see who they're requesting from
CREATE POLICY "Public reads basic pro info"
ON public.profiles FOR SELECT
USING (true);

CREATE INDEX idx_quote_requests_pro ON public.quote_requests(pro_user_id, created_at DESC);
CREATE INDEX idx_quote_requests_customer ON public.quote_requests(customer_user_id, created_at DESC);

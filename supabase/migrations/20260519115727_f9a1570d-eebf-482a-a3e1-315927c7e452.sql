-- Site captures: tradesperson walks a property, captures items, then generates a quote
CREATE TABLE public.site_captures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_name TEXT,
  address TEXT,
  trade_type TEXT,
  vat_registered BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active', -- active | generated | archived
  generated_quote_id UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own site captures"
  ON public.site_captures FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_site_captures_updated_at
  BEFORE UPDATE ON public.site_captures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_site_captures_user_status ON public.site_captures(user_id, status, updated_at DESC);

-- Items captured during a site walk
CREATE TABLE public.site_capture_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  capture_id UUID NOT NULL REFERENCES public.site_captures(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual', -- manual | voice | chip
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_capture_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own capture items"
  ON public.site_capture_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_site_capture_items_updated_at
  BEFORE UPDATE ON public.site_capture_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_site_capture_items_capture ON public.site_capture_items(capture_id, position);
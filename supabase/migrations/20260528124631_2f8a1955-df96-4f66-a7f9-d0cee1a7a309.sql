ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_status_check;

ALTER TABLE public.quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('pending','sent','accepted','completed','declined','paid','overdue'));
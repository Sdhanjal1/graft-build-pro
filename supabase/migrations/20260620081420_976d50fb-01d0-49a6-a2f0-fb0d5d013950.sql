ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS invoice_email_status TEXT,
  ADD COLUMN IF NOT EXISTS invoice_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_email_error TEXT,
  ADD COLUMN IF NOT EXISTS invoice_email_to TEXT;
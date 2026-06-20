CREATE UNIQUE INDEX IF NOT EXISTS invoice_payments_pi_unique
  ON public.invoice_payments (stripe_payment_intent)
  WHERE stripe_payment_intent IS NOT NULL;
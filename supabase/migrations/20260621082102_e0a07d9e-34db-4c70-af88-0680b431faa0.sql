
CREATE TABLE public.payment_webhook_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  user_id uuid,
  quote_id text,
  request_type text,
  amount_cents integer,
  currency text,
  stripe_session_id text,
  stripe_payment_intent text,
  received_at timestamptz NOT NULL DEFAULT now(),
  receipt_status text,
  receipt_sent_at timestamptz,
  receipt_to text,
  receipt_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_webhook_audit_quote ON public.payment_webhook_audit(quote_id);
CREATE INDEX idx_payment_webhook_audit_user ON public.payment_webhook_audit(user_id);

GRANT SELECT ON public.payment_webhook_audit TO authenticated;
GRANT ALL ON public.payment_webhook_audit TO service_role;

ALTER TABLE public.payment_webhook_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own webhook audit"
  ON public.payment_webhook_audit
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

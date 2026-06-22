-- Reset duplicate 'sent' audit rows to NULL, keeping the earliest one
-- per (quote_id, request_type). The earliest row is the one that actually
-- triggered the email/push; the duplicates are racing events we want to
-- prevent going forward.
WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY quote_id, request_type
      ORDER BY receipt_sent_at ASC NULLS LAST, created_at ASC
    ) AS rn
  FROM public.payment_webhook_audit
  WHERE receipt_status = 'sent' AND quote_id IS NOT NULL
)
UPDATE public.payment_webhook_audit a
SET receipt_status = 'duplicate_suppressed'
FROM ranked r
WHERE a.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_audit_receipt_once
  ON public.payment_webhook_audit (quote_id, request_type)
  WHERE receipt_status = 'sent';
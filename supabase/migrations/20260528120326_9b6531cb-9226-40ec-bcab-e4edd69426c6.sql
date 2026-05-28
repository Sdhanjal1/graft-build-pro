ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_payment_timing_check;
UPDATE public.quotes SET payment_timing = 'deposit_then_balance' WHERE payment_timing = 'staged';
ALTER TABLE public.quotes ADD CONSTRAINT quotes_payment_timing_check CHECK (payment_timing = ANY (ARRAY['on_completion'::text, 'deposit_then_balance'::text, 'upfront'::text]));
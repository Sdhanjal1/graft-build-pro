-- 1) Drop the dangerously permissive public read on profiles
DROP POLICY IF EXISTS "Public reads basic pro info" ON public.profiles;

-- 2) Lock down invoice_payments mutations from client roles
CREATE POLICY "No client inserts on invoice payments"
  ON public.invoice_payments FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "No client updates on invoice payments"
  ON public.invoice_payments FOR UPDATE
  TO authenticated, anon
  USING (false);

CREATE POLICY "No client deletes on invoice payments"
  ON public.invoice_payments FOR DELETE
  TO authenticated, anon
  USING (false);

-- 3) Lock down subscriptions mutations from client roles
CREATE POLICY "No client inserts on subscriptions"
  ON public.subscriptions FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "No client updates on subscriptions"
  ON public.subscriptions FOR UPDATE
  TO authenticated, anon
  USING (false);

CREATE POLICY "No client deletes on subscriptions"
  ON public.subscriptions FOR DELETE
  TO authenticated, anon
  USING (false);
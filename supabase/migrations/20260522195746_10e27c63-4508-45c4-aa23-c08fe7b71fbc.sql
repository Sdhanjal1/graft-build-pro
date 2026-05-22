-- quote_messages: split ALL policy and constrain sender for authenticated inserts
DROP POLICY IF EXISTS "Users manage own quote messages" ON public.quote_messages;

CREATE POLICY "Users view own quote messages"
  ON public.quote_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Pros insert pro quote messages"
  ON public.quote_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND sender = 'pro');

CREATE POLICY "Users update own quote messages"
  ON public.quote_messages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own quote messages"
  ON public.quote_messages FOR DELETE
  USING (auth.uid() = user_id);

-- client_portal_messages: same treatment
DROP POLICY IF EXISTS "Users manage own client portal messages" ON public.client_portal_messages;

CREATE POLICY "Users view own client portal messages"
  ON public.client_portal_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Pros insert pro client portal messages"
  ON public.client_portal_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND sender = 'pro');

CREATE POLICY "Users update own client portal messages"
  ON public.client_portal_messages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own client portal messages"
  ON public.client_portal_messages FOR DELETE
  USING (auth.uid() = user_id);
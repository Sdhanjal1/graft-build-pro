
-- 1. Lock down sender field on quote_messages
DROP POLICY IF EXISTS "Users update own quote messages" ON public.quote_messages;
CREATE POLICY "Users update own quote messages"
ON public.quote_messages
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND sender = 'pro');

-- 2. Lock down sender field on client_portal_messages
DROP POLICY IF EXISTS "Users update own client portal messages" ON public.client_portal_messages;
CREATE POLICY "Users update own client portal messages"
ON public.client_portal_messages
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND sender = 'pro');

-- 3. Realtime channel authorization
-- Convention: clients subscribe to topics prefixed with their auth.uid(), e.g. "user:<uid>:messages"
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users subscribe to own realtime topics" ON realtime.messages;
CREATE POLICY "Users subscribe to own realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'user:' || auth.uid()::text || ':%'
);

DROP POLICY IF EXISTS "Users broadcast to own realtime topics" ON realtime.messages;
CREATE POLICY "Users broadcast to own realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'user:' || auth.uid()::text || ':%'
);


-- Portal access tokens
CREATE TABLE public.quote_portal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL,
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  channel text NOT NULL DEFAULT 'sms', -- 'sms' | 'email' | 'manual'
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
CREATE INDEX idx_quote_portal_tokens_quote ON public.quote_portal_tokens(quote_id);
ALTER TABLE public.quote_portal_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own portal tokens"
  ON public.quote_portal_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Messages between pro and customer for a quote
CREATE TABLE public.quote_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL,
  user_id uuid NOT NULL, -- owning pro
  sender text NOT NULL CHECK (sender IN ('customer','pro','system')),
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_quote_messages_quote ON public.quote_messages(quote_id, created_at);
CREATE INDEX idx_quote_messages_user ON public.quote_messages(user_id, created_at DESC);
ALTER TABLE public.quote_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own quote messages"
  ON public.quote_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.quote_messages;

-- Working hours / Do Not Disturb per user
CREATE TABLE public.working_hours (
  user_id uuid PRIMARY KEY,
  dnd_enabled boolean NOT NULL DEFAULT true,
  -- schedule: { mon: {enabled, start, end}, tue: {...}, ... }
  schedule jsonb NOT NULL DEFAULT '{
    "mon":{"enabled":true,"start":"08:00","end":"18:00"},
    "tue":{"enabled":true,"start":"08:00","end":"18:00"},
    "wed":{"enabled":true,"start":"08:00","end":"18:00"},
    "thu":{"enabled":true,"start":"08:00","end":"18:00"},
    "fri":{"enabled":true,"start":"08:00","end":"18:00"},
    "sat":{"enabled":false,"start":"09:00","end":"13:00"},
    "sun":{"enabled":false,"start":"09:00","end":"13:00"}
  }'::jsonb,
  auto_reply text NOT NULL DEFAULT 'Thanks for your message. We will get back to you during working hours.',
  timezone text NOT NULL DEFAULT 'Europe/London',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own working hours"
  ON public.working_hours FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own working hours"
  ON public.working_hours FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own working hours"
  ON public.working_hours FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER trg_working_hours_updated_at
  BEFORE UPDATE ON public.working_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

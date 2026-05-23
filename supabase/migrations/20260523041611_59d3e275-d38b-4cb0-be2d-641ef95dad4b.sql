
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS reminder_last_sent_at timestamptz;

ALTER PUBLICATION supabase_realtime ADD TABLE public.client_portal_messages;
ALTER TABLE public.client_portal_messages REPLICA IDENTITY FULL;

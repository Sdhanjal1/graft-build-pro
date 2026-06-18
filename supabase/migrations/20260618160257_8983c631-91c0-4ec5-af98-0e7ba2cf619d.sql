
-- Lock down SECURITY DEFINER functions: revoke EXECUTE from anon/authenticated
-- on trigger-only and internal helper functions. Keep is_admin callable by
-- authenticated users (used by server-side RPC for admin gating).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_subscription() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_client_portal_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_portal_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;

-- error_events: add explicit deny-all policies so intent is clear and future
-- accidental exposure is blocked. Writes go through service_role only.
CREATE POLICY "Deny all SELECT on error_events"
  ON public.error_events FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY "Deny all INSERT on error_events"
  ON public.error_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "Deny all UPDATE on error_events"
  ON public.error_events FOR UPDATE
  TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny all DELETE on error_events"
  ON public.error_events FOR DELETE
  TO anon, authenticated
  USING (false);

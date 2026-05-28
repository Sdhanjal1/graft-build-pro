ALTER FUNCTION public.generate_portal_code() SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.generate_portal_code() FROM anon;
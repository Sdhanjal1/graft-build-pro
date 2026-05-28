ALTER FUNCTION public.generate_portal_code() SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION public.generate_portal_code() TO authenticated, anon, service_role;
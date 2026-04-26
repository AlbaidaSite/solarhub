-- =====================================================================
-- LOGIN POR USERNAME O EMAIL
-- Resuelve un username al email asociado en auth.users para que el
-- cliente pueda autenticar con signInWithPassword (que solo acepta
-- email). SECURITY DEFINER porque auth.users no es accesible para anon.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.email_for_username(username_to_check text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.email
    FROM public.profile p
    JOIN auth.users u ON u.id = p.id
   WHERE lower(p.username) = lower(username_to_check)
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.email_for_username(text) TO anon, authenticated;

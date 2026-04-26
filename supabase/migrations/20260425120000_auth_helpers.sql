-- =====================================================================
-- AUTH HELPERS
-- RPC functions used by the auth/register flow to check existence
-- of an email or username before creating the account.
-- Both run with SECURITY DEFINER so anon clients can call them
-- without direct access to auth.users or profile rows.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.email_exists(email_to_check text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = lower(email_to_check)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.username_exists(username_to_check text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profile
    WHERE lower(username) = lower(username_to_check)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.email_exists(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.username_exists(text) TO anon, authenticated;

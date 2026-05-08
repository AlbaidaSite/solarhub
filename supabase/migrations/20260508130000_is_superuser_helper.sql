CREATE OR REPLACE FUNCTION public.is_superuser()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT c.is_superuser
      FROM credentials c
     WHERE c.user_id = auth.uid()
  ), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_superuser() TO authenticated;

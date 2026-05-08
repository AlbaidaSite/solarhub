-- Returns all users with their profile and credential data for staff.
-- SECURITY DEFINER to access auth.users (email).
CREATE OR REPLACE FUNCTION public.get_all_users_staff()
RETURNS TABLE (
  user_id          uuid,
  name             text,
  username         text,
  email            text,
  is_active        boolean,
  is_staff         boolean,
  is_superuser     boolean,
  is_loukou        boolean,
  is_garden_manager boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    p.id              AS user_id,
    p.name,
    p.username,
    u.email,
    c.is_active,
    c.is_staff,
    c.is_superuser,
    c.is_loukou,
    c.is_garden_manager
  FROM   profile     p
  JOIN   credentials c ON c.user_id = p.id
  JOIN   auth.users  u ON u.id      = p.id
  WHERE  public.is_staff()
  ORDER  BY p.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_users_staff() TO authenticated;

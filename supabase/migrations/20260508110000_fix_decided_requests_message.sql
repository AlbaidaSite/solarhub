-- Fix: include message column in get_decided_requests_staff
DROP FUNCTION IF EXISTS public.get_decided_requests_staff(int);

CREATE OR REPLACE FUNCTION public.get_decided_requests_staff(lim int DEFAULT 20)
RETURNS TABLE (
  request_id   int,
  user_id      uuid,
  is_approved  boolean,
  request_date timestamptz,
  username     text,
  name         text,
  email        text,
  message      text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    r.id            AS request_id,
    r.user_id,
    r.is_approved,
    r.request_date,
    p.username,
    p.name,
    u.email,
    r.message
  FROM   request r
  JOIN   profile  p ON p.id = r.user_id
  JOIN   auth.users u ON u.id = r.user_id
  WHERE  r.is_approved IS NOT NULL
    AND  public.is_staff()
  ORDER  BY r.request_date DESC
  LIMIT  lim;
$$;

GRANT EXECUTE ON FUNCTION public.get_decided_requests_staff(int) TO authenticated;

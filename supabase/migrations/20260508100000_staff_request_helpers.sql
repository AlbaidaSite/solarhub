-- =====================================================================
-- STAFF: helpers para gestionar solicitudes de registro
-- =====================================================================

-- Devuelve las solicitudes pendientes (is_approved IS NULL) con datos
-- del perfil y el correo de auth.users. Solo accesible para staff.
CREATE OR REPLACE FUNCTION public.get_pending_requests_staff()
RETURNS TABLE (
  request_id  int,
  user_id     uuid,
  message     text,
  request_date timestamptz,
  username    text,
  name        text,
  email       text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    r.id            AS request_id,
    r.user_id,
    r.message,
    r.request_date,
    p.username,
    p.name,
    u.email
  FROM   request r
  JOIN   profile  p ON p.id = r.user_id
  JOIN   auth.users u ON u.id = r.user_id
  WHERE  r.is_approved IS NULL
    AND  public.is_staff()
  ORDER  BY r.request_date ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_requests_staff() TO authenticated;


-- Devuelve las últimas solicitudes ya resueltas (aprobadas o denegadas).
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


-- =====================================================================
-- RE-REGISTRATION: helpers para que un usuario desactivado vuelva a
-- solicitar acceso con el mismo correo desde el formulario de login.
-- =====================================================================

-- Devuelve el estado de un correo para la lógica de re-registro:
--   'active'       → cuenta activa; no se puede re-registrar
--   'pending'      → ya tiene una solicitud pendiente
--   'can_reregister' → desactivado sin solicitud pendiente
--   'not_found'    → no existe cuenta (flujo normal)
-- Accesible para anon (se llama antes del login).
CREATE OR REPLACE FUNCTION public.get_email_registration_status(p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_is_active boolean;
  v_has_pending boolean;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN 'not_found';
  END IF;

  SELECT is_active INTO v_is_active
  FROM credentials
  WHERE user_id = v_user_id;

  IF v_is_active IS TRUE THEN
    RETURN 'active';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM request
    WHERE user_id = v_user_id
      AND is_approved IS NULL
  ) INTO v_has_pending;

  IF v_has_pending THEN
    RETURN 'pending';
  END IF;

  RETURN 'can_reregister';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_registration_status(text) TO anon, authenticated;


-- Devuelve el user_id (uuid) dado un correo. Solo para service_role
-- (lo llaman server actions con el cliente admin).
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO service_role;

-- =====================================================================
-- DEFAULTS DE ALTA DE CUENTA
-- Corrige/asegura el estado inicial de una cuenta recién registrada:
--   1. profile.profile_img  -> avatar compartido por defecto
--   2. credentials.is_active -> false en el alta (solo pasa a true al
--      aprobar la request vía trg_activate_credentials_on_request_approval).
--
-- El esquema inicial ya definía is_active DEFAULT false, pero en algún
-- entorno el default había derivado a true; aquí se reasegura y se hace
-- el trigger de creación de credenciales explícito para que no dependa
-- del default de la columna.
-- =====================================================================


-- ---------------------------------------------------------------------
-- profile.profile_img: default = avatar compartido
-- ---------------------------------------------------------------------
ALTER TABLE public.profile
  ALTER COLUMN profile_img SET DEFAULT 'profiles/default_profile.webp';

-- Backfill: perfiles ya creados sin imagen apuntan al avatar por defecto
-- (coincide con el fallback de lectura DEFAULT_AVATAR_PATH del frontend).
UPDATE public.profile
   SET profile_img = 'profiles/default_profile.webp'
 WHERE profile_img IS NULL;


-- ---------------------------------------------------------------------
-- credentials.is_active: reasegura el default a false
-- ---------------------------------------------------------------------
ALTER TABLE public.credentials
  ALTER COLUMN is_active SET DEFAULT false;

-- Trigger de creación de credenciales: explícito en is_active = false,
-- así no depende del default de la columna. El resto de flags
-- (is_staff, is_superuser, ...) siguen tomando su DEFAULT false.
CREATE OR REPLACE FUNCTION public.create_credentials_for_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.credentials (user_id, is_active)
  VALUES (NEW.id, false);
  RETURN NEW;
END;
$$;

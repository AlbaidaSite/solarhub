-- =====================================================================
-- TRIGGER: poner has_owners=true al registrar un unique
-- =====================================================================
-- Cuando se inserta una fila en unique_ownership (registro de una copia
-- por un usuario), el campo cromo_labels.has_owners pasa a true para el
-- cromo al que pertenece ese unique. Esta es la transición de "nadie lo
-- tiene" a "alguien lo ha desbloqueado", que permite ver la imagen real.
--
-- Una vez puesto a true, has_owners nunca vuelve a false: es el historial
-- de "alguna vez fue registrado".
--
-- SECURITY DEFINER: el trigger corre con privilegios del dueño de la
-- función (postgres / service role) para poder modificar cromo_labels
-- incluso cuando el usuario que inserta sea authenticated con RLS activa.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.set_has_owners_on_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE cromo_labels cl
  SET    has_owners = true
  FROM   unique_cromo uc
  JOIN   cromo        c  ON c.id       = uc.cromo_id
  WHERE  uc.id       = NEW.unique_id
    AND  c.labels_id = cl.id
    AND  cl.has_owners = false;  -- no-op si ya era true

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_has_owners_on_registration ON unique_ownership;

CREATE TRIGGER trg_set_has_owners_on_registration
  AFTER INSERT ON unique_ownership
  FOR EACH ROW
  EXECUTE FUNCTION public.set_has_owners_on_registration();
-- =====================================================================
-- ROLE HELPERS
-- Una función SECURITY DEFINER por rol para usar en políticas RLS.
-- Cada nivel "inferior" incluye superuser como fallback porque superuser
-- tiene todos los privilegios.
-- =====================================================================


-- =====================================================================
-- is_superuser(): solo el flag puro
-- =====================================================================

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


-- =====================================================================
-- is_garden_manager(): garden_manager OR superuser
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_garden_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT (c.is_garden_manager OR c.is_superuser)
      FROM credentials c
     WHERE c.user_id = auth.uid()
  ), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_garden_manager() TO authenticated;


-- =====================================================================
-- is_loukou(): loukou OR superuser
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_loukou()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT (c.is_loukou OR c.is_superuser)
      FROM credentials c
     WHERE c.user_id = auth.uid()
  ), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_loukou() TO authenticated;


-- =====================================================================
-- FIX: credentials UPDATE solo superuser
-- La política previa permitía a cualquier staff modificar credentials,
-- lo que abre la puerta a auto-promoverse o promover a otros a
-- is_superuser. Solo superuser debe poder tocar flags de roles.
-- La activación al aprobar request sigue funcionando porque el trigger
-- trg_activate_credentials_on_request_approval es SECURITY DEFINER.
-- =====================================================================

DROP POLICY IF EXISTS credentials_update_staff_only ON public.credentials;

CREATE POLICY credentials_update_superuser_only
  ON public.credentials FOR UPDATE
  TO authenticated
  USING (public.is_superuser())
  WITH CHECK (public.is_superuser());


-- =====================================================================
-- HUERTO: lectura abierta a auth, escritura solo garden_manager
-- =====================================================================

ALTER TABLE public.plant ENABLE ROW LEVEL SECURITY;
CREATE POLICY plant_select_auth
  ON public.plant FOR SELECT TO authenticated USING (true);
CREATE POLICY plant_write_garden_manager
  ON public.plant FOR ALL TO authenticated
  USING (public.is_garden_manager())
  WITH CHECK (public.is_garden_manager());

ALTER TABLE public.garden_bed ENABLE ROW LEVEL SECURITY;
CREATE POLICY garden_bed_select_auth
  ON public.garden_bed FOR SELECT TO authenticated USING (true);
CREATE POLICY garden_bed_write_garden_manager
  ON public.garden_bed FOR ALL TO authenticated
  USING (public.is_garden_manager())
  WITH CHECK (public.is_garden_manager());

ALTER TABLE public.garden_work ENABLE ROW LEVEL SECURITY;
CREATE POLICY garden_work_select_auth
  ON public.garden_work FOR SELECT TO authenticated USING (true);
CREATE POLICY garden_work_write_garden_manager
  ON public.garden_work FOR ALL TO authenticated
  USING (public.is_garden_manager())
  WITH CHECK (public.is_garden_manager());

ALTER TABLE public.crop_diary ENABLE ROW LEVEL SECURITY;
CREATE POLICY crop_diary_select_auth
  ON public.crop_diary FOR SELECT TO authenticated USING (true);
CREATE POLICY crop_diary_write_garden_manager
  ON public.crop_diary FOR ALL TO authenticated
  USING (public.is_garden_manager())
  WITH CHECK (public.is_garden_manager());


-- =====================================================================
-- NOTAS SOBRE is_loukou()
--
-- Los cromos con cromo_labels.for_loukou = true deberían ser visibles
-- solo a loukou (o staff). Hoy en día Album.tsx no filtra ese flag.
-- Cuando quieras enforcement a nivel BD, cambia la policy de cromo:
--
--   DROP POLICY cromo_select_auth ON cromo;
--   CREATE POLICY cromo_select_visible ON cromo FOR SELECT TO authenticated
--   USING (
--     public.is_staff()
--     OR NOT EXISTS (
--          SELECT 1 FROM cromo_labels l
--           WHERE l.id = cromo.labels_id AND l.for_loukou
--        )
--     OR public.is_loukou()
--   );
--
-- Hazlo solo cuando la app esté preparada para recibir menos filas
-- (ahora mismo Album cuenta con tener todas).
-- =====================================================================

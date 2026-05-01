-- =====================================================================
-- STORAGE: políticas para subir / borrar cromos (carpeta `cromos/`)
-- =====================================================================
-- El bucket `solarhub-assets` se creó como público (lectura). Para que
-- el staff pueda subir imágenes desde la vista /staff/cromos/crear hace
-- falta añadir policies INSERT/UPDATE/DELETE sobre storage.objects
-- restringidas a la carpeta `cromos/` y al rol de staff.
--
-- `storage.foldername(name)` devuelve un array con las carpetas del path.
-- Para `cromos/foo.webp` devuelve `{cromos}`; para `cromos/thumb/x.webp`
-- devuelve `{cromos, thumb}`. En ambos casos `[1] = 'cromos'`, así que
-- la policy cubre tanto los originales como los thumbnails.
-- =====================================================================

DROP POLICY IF EXISTS storage_cromos_insert_staff ON storage.objects;
DROP POLICY IF EXISTS storage_cromos_update_staff ON storage.objects;
DROP POLICY IF EXISTS storage_cromos_delete_staff ON storage.objects;

CREATE POLICY storage_cromos_insert_staff
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'solarhub-assets'
    AND (storage.foldername(name))[1] = 'cromos'
    AND public.is_staff()
  );

CREATE POLICY storage_cromos_update_staff
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'solarhub-assets'
    AND (storage.foldername(name))[1] = 'cromos'
    AND public.is_staff()
  )
  WITH CHECK (
    bucket_id = 'solarhub-assets'
    AND (storage.foldername(name))[1] = 'cromos'
    AND public.is_staff()
  );

CREATE POLICY storage_cromos_delete_staff
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'solarhub-assets'
    AND (storage.foldername(name))[1] = 'cromos'
    AND public.is_staff()
  );
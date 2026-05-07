-- =====================================================================
-- STORAGE: políticas para la carpeta `map-media/`
-- =====================================================================
-- Los usuarios autenticados pueden subir archivos a la carpeta
-- `map-media/` del bucket solarhub-assets para adjuntarlos a sus pins.
-- La validación de que el pin pertenece al usuario se hace en el server
-- action (addMapMediaAction) antes de insertar en map_media.
--
-- Estructura de ruta esperada: map-media/{pin_id}/{uuid}.{ext}
-- =====================================================================

DROP POLICY IF EXISTS storage_map_media_insert_auth ON storage.objects;
DROP POLICY IF EXISTS storage_map_media_delete_own  ON storage.objects;

-- Cualquier usuario autenticado puede subir archivos a map-media/
CREATE POLICY storage_map_media_insert_auth
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'solarhub-assets'
    AND (storage.foldername(name))[1] = 'map-media'
  );

-- Los usuarios solo pueden eliminar sus propios archivos de map-media/
-- (el path incluye el pin_id; la propiedad del pin se verifica en SQL)
CREATE POLICY storage_map_media_delete_own
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'solarhub-assets'
    AND (storage.foldername(name))[1] = 'map-media'
    AND owner = auth.uid()
  );

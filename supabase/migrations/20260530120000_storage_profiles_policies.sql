-- =====================================================================
-- STORAGE: políticas para la carpeta `profiles/`
-- =====================================================================
-- Cada usuario autenticado puede subir, reemplazar y borrar su propio
-- avatar dentro de su subcarpeta `profiles/{auth.uid()}/`. El avatar por
-- defecto vive en `profiles/default_profile.webp` (raíz de la carpeta,
-- subido por el service role vía dashboard/CLI): al exigir que el segundo
-- segmento del path sea el uid del usuario, este queda protegido y nadie
-- puede sobrescribirlo ni eliminarlo desde el cliente.
--
-- Estructura de ruta esperada: profiles/{user_id}/{uuid}.webp
--
-- Resuelve el TODO de 20260426180000_storage_bucket.sql.
-- =====================================================================

DROP POLICY IF EXISTS storage_profiles_insert_own ON storage.objects;
DROP POLICY IF EXISTS storage_profiles_update_own ON storage.objects;
DROP POLICY IF EXISTS storage_profiles_delete_own ON storage.objects;

-- Subir un avatar a la propia subcarpeta
CREATE POLICY storage_profiles_insert_own
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'solarhub-assets'
    AND (storage.foldername(name))[1] = 'profiles'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Reemplazar (upsert) un avatar de la propia subcarpeta
CREATE POLICY storage_profiles_update_own
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'solarhub-assets'
    AND (storage.foldername(name))[1] = 'profiles'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'solarhub-assets'
    AND (storage.foldername(name))[1] = 'profiles'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Borrar el avatar anterior de la propia subcarpeta
CREATE POLICY storage_profiles_delete_own
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'solarhub-assets'
    AND (storage.foldername(name))[1] = 'profiles'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- =====================================================================
-- STORAGE: bucket público de assets
-- =====================================================================
-- Bucket que sirve los archivos públicos del proyecto (avatares de
-- perfil, imágenes de cromos, etc.). Tiene que ser público para que
-- getPublicUrl() devuelva URLs realmente accesibles desde el cliente.
--
-- Idempotente: si ya creaste el bucket a mano vía dashboard,
-- ON CONFLICT DO NOTHING deja la configuración existente intacta.
--
-- Para que el avatar por defecto funcione, también hay que subir el
-- archivo a la ruta profiles/default_profile.webp (no se hace por SQL,
-- sube el .webp desde el dashboard o con el CLI de storage).
--
-- TODO: cuando se implemente la subida de avatar por el usuario,
-- añadir aquí policies INSERT/UPDATE/DELETE sobre storage.objects
-- restringidas a la carpeta del propio usuario, p. ej.:
--   (storage.foldername(name))[1] = 'profiles'
--   AND (storage.foldername(name))[2] = auth.uid()::text
-- =====================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('solarhub-assets', 'solarhub-assets', true)
ON CONFLICT (id) DO NOTHING;

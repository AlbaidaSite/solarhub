-- =====================================================================
-- STICKER: RLS policies + storage policies para la carpeta `stickers/`
-- =====================================================================
-- La tabla sticker es un catálogo gestionado únicamente por staff.
-- Lectura libre para cualquier usuario autenticado (la app la necesita
-- para renderizar los pins del mapa). Escritura restringida a staff.
-- =====================================================================

-- RLS (idempotente si ya estaba habilitado vía dashboard)
ALTER TABLE public.sticker ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sticker_select_auth  ON public.sticker;
DROP POLICY IF EXISTS sticker_write_staff  ON public.sticker;

CREATE POLICY sticker_select_auth
  ON public.sticker FOR SELECT TO authenticated
  USING (true);

CREATE POLICY sticker_write_staff
  ON public.sticker FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());


-- =====================================================================
-- STORAGE: políticas para la carpeta `stickers/`
-- Los iconos de sticker solo los sube / borra staff.
-- Estructura de ruta: stickers/{uuid}.{ext}
-- =====================================================================

DROP POLICY IF EXISTS storage_stickers_insert_staff ON storage.objects;
DROP POLICY IF EXISTS storage_stickers_update_staff ON storage.objects;
DROP POLICY IF EXISTS storage_stickers_delete_staff ON storage.objects;

CREATE POLICY storage_stickers_insert_staff
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'solarhub-assets'
    AND (storage.foldername(name))[1] = 'stickers'
    AND public.is_staff()
  );

CREATE POLICY storage_stickers_update_staff
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'solarhub-assets'
    AND (storage.foldername(name))[1] = 'stickers'
    AND public.is_staff()
  )
  WITH CHECK (
    bucket_id = 'solarhub-assets'
    AND (storage.foldername(name))[1] = 'stickers'
    AND public.is_staff()
  );

CREATE POLICY storage_stickers_delete_staff
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'solarhub-assets'
    AND (storage.foldername(name))[1] = 'stickers'
    AND public.is_staff()
  );

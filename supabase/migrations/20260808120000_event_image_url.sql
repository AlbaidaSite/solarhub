-- =====================================================================
-- CALENDARIO: imagen de evento
-- =====================================================================
-- `image_url` guarda una RUTA de Supabase Storage (bucket `solarhub-assets`),
-- NUNCA una URL absoluta. Se resuelve con getStorageUrl() (src/lib/supabase/storage.ts),
-- igual que icon_path de sticker/event_type o path de map_media.
--
-- Nullable a propósito: los cumpleaños no la usan y muchos eventos se crean
-- sin foto.
--
-- Estructura de ruta esperada: event-images/{event_id}/{uuid}.{ext}
-- =====================================================================

alter table public.event add column image_url text;

-- Cualquier usuario autenticado puede subir archivos a event-images/
create policy storage_event_images_insert_auth
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'solarhub-assets'
    and (storage.foldername(name))[1] = 'event-images'
  );

-- Solo el dueño del evento (o staff) puede borrar sus imágenes.
-- El path incluye el event_id: event-images/{event_id}/{uuid}.{ext}
create policy storage_event_images_delete_owner_or_staff
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'solarhub-assets'
    and (storage.foldername(name))[1] = 'event-images'
    and exists (
      select 1 from public.event e
      where e.id = ((storage.foldername(name))[2])::int
        and (e.user_id = auth.uid() or public.is_staff())
    )
  );

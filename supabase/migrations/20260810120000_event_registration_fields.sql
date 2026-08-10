-- =====================================================================
-- CALENDARIO: campos del formulario "Nuevo evento"
-- =====================================================================
-- Añade lo que necesita el formulario de alta de eventos y que todavía
-- no existía en el esquema:
--   - fecha de fin opcional (end_date)
--   - flags de "¿el usuario dio una hora?" para inicio/fin, porque el
--     formulario permite fecha sin hora (se guarda medianoche
--     Europe/Madrid como valor neutro y el flag le dice a la UI si esa
--     hora es real o solo un placeholder)
--   - "ocultar a externos" (hide_external)
--   - tabla event_photo para las fotos adicionales (máx. 3 en total:
--     la 1ª sigue guardándose en event.image_url, que ya existía y ya
--     consume events_in_range/EventImageLayer/CalendarCell tal cual)
-- =====================================================================

alter table public.event add column end_date timestamptz;
alter table public.event add column start_time_included boolean not null default true;
alter table public.event add column end_time_included boolean not null default true;

-- "Ocultar a externos": mismo patrón que cromo_labels.for_loukou (ver
-- notas al final de 20260426160000_role_helpers.sql). Se guarda el flag
-- ya, pero el enforcement en lectura (filtrar eventos ocultos en
-- events_in_range para quien no sea is_loukou()/is_staff()) se deja
-- para una migración posterior, cuando el calendario esté listo para
-- recibir menos eventos — igual que se decidió para for_loukou.
alter table public.event add column hide_external boolean not null default false;

-- event_photo: fotos adicionales del evento (la portada sigue en
-- event.image_url). RLS calcada de event_price (hereda el permiso del
-- event padre: dueño o staff).
create table public.event_photo (
  id serial primary key,
  event_id int not null references public.event(id) on delete cascade,
  path text not null
);

alter table public.event_photo enable row level security;

create policy event_photo_select_auth
  on public.event_photo for select to authenticated using (true);

create policy event_photo_write_event_owner
  on public.event_photo for all to authenticated
  using (
    exists (
      select 1 from public.event e
       where e.id = event_photo.event_id
         and (e.user_id = auth.uid() or public.is_staff())
    )
  )
  with check (
    exists (
      select 1 from public.event e
       where e.id = event_photo.event_id
         and (e.user_id = auth.uid() or public.is_staff())
    )
  );

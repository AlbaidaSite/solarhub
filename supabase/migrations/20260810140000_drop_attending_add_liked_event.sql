-- =====================================================================
-- CALENDARIO: sustituir attending por liked_event
-- =====================================================================
-- `attending` (con su estado GOING/NOT_GOING y el guardado de recurrencia
-- anual) queda fuera de alcance por ahora: se sustituye por una relación
-- simple usuario↔evento (`liked_event`, un "me gusta"), sin estado ni
-- lógica de recurrencia. Cuando se retome la funcionalidad de asistencia
-- se diseñará de nuevo desde cero sobre esta tabla o una nueva.
--
-- Se eliminan, en orden de dependencia: los dos triggers de guarda de
-- 20260808120400_event_yearly_attendance_guard.sql (uno sobre `event`,
-- otro sobre `attending`) y sus funciones, las políticas RLS de
-- `attending` (20260601120000_enable_rls_remaining_tables.sql), la
-- propia tabla y el enum `attending_status`
-- (20260418211915_initial_schema.sql).
-- =====================================================================

drop trigger if exists trg_prevent_yearly_recurrence_with_attendance on public.event;
drop function if exists public.prevent_yearly_recurrence_with_attendance();

drop trigger if exists trg_prevent_attending_on_yearly_event on public.attending;
drop function if exists public.prevent_attending_on_yearly_event();

drop policy if exists attending_select_auth on public.attending;
drop policy if exists attending_insert_self on public.attending;
drop policy if exists attending_update_self on public.attending;
drop policy if exists attending_delete_self on public.attending;

drop table if exists public.attending;
drop type if exists attending_status;

-- liked_event: relación simple, sin estado. RLS calcada de attending
-- (lectura: cualquier autenticado; escritura: solo tus propias filas).
-- Sin server actions ni UI todavía — es solo la base de esquema para
-- cuando se implemente la funcionalidad de "me gusta".
create table public.liked_event (
  id bigserial primary key,
  user_id uuid not null references public.profile(id) on delete cascade,
  event_id int not null references public.event(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

alter table public.liked_event enable row level security;

create policy liked_event_select_auth
  on public.liked_event for select to authenticated using (true);

create policy liked_event_write_self
  on public.liked_event for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

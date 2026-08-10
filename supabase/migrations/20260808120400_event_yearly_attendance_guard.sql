-- =====================================================================
-- CALENDARIO: recurrencia anual incompatible con asistencia
-- =====================================================================
-- La recurrencia anual solo tiene sentido hoy para cumpleaños, que no admiten
-- asistencia. `attending` no guarda año, así que un evento anual normal
-- arrastraría los "Voy" de un año al siguiente en silencio.
-- Si algún día hacen falta eventos anuales con asistencia: añadir
-- occurrence_date a attending y mover la clave única a
-- (user_id, event_id, occurrence_date), y eliminar esta restricción.
--
-- Un CHECK no puede consultar otra tabla, así que se implementa como un
-- par de triggers de validación que cubren ambas direcciones:
--   1. No se puede marcar asistencia sobre un evento YEARLY.
--   2. No se puede pasar un evento a YEARLY si ya tiene asistencia.
--
-- (`attending.user_id`/`attending.event_id` — el diagrama de clases del
-- proyecto los llama distinto, pero estos son los nombres reales de las FK.)
-- =====================================================================

create or replace function public.prevent_attending_on_yearly_event()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from public.event e
    where e.id = new.event_id and e.recurrence = 'YEARLY'
  ) then
    raise exception 'No se puede marcar asistencia en un evento con recurrencia anual.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_attending_on_yearly_event on public.attending;
create trigger trg_prevent_attending_on_yearly_event
  before insert or update on public.attending
  for each row execute function public.prevent_attending_on_yearly_event();

create or replace function public.prevent_yearly_recurrence_with_attendance()
returns trigger
language plpgsql
as $$
begin
  if new.recurrence = 'YEARLY' and exists (
    select 1 from public.attending a where a.event_id = new.id
  ) then
    raise exception 'No se puede fijar recurrencia anual en un evento con asistencia registrada.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_yearly_recurrence_with_attendance on public.event;
create trigger trg_prevent_yearly_recurrence_with_attendance
  before insert or update on public.event
  for each row execute function public.prevent_yearly_recurrence_with_attendance();

-- =====================================================================
-- CALENDARIO: events_in_range trae hora y fecha de fin
-- =====================================================================
-- El modal de detalle de evento necesita pintar "hh:mm" (solo si el
-- usuario dio hora) y una línea opcional "Hasta: dd/MM/yyyy hh:mm", y no
-- debe disparar una petición aparte para conseguirlo — así que se añaden
-- al RPC los campos que ya existían en `event` desde
-- 20260810120000_event_registration_fields.sql pero que la función
-- todavía no exponía: `event_date` completo (no solo la fecha calculada
-- en `occurrence_date`), `end_date`, `start_time_included`,
-- `end_time_included`.
--
-- `event_date` se devuelve tal cual está en BD (UTC): la hora del día no
-- cambia con la proyección de recurrencia anual, solo el año/mes/día
-- (eso ya lo resuelve `occurrence_date`), así que no hace falta
-- reproyectarla — el cliente solo debe leer la hora de aquí y la fecha
-- de `occurrence_date`, nunca el año de `event_date` para un evento
-- YEARLY.
-- =====================================================================

-- `create or replace` no puede cambiar el tipo de retorno (columnas OUT)
-- de una función existente — hay que borrarla primero.
drop function if exists public.events_in_range(date, date);

create function public.events_in_range(
  range_start date,
  range_end   date
)
returns table (
  id                   integer,
  occurrence_date      date,
  title                text,
  description          text,
  place                text,
  image_url            text,
  url                  text,
  includes_cromo       boolean,
  event_date           timestamptz,
  end_date             timestamptz,
  start_time_included  boolean,
  end_time_included    boolean,
  event_type_id        smallint,
  event_type_code      text,
  event_type_name      text,
  event_type_icon_path text,
  event_type_color     text
)
language sql
stable
security invoker
as $$
  with local_events as (
    select
      e.id,
      e.title,
      e.description,
      e.place,
      e.image_url,
      e.url,
      e.includes_cromo,
      e.recurrence,
      e.event_date,
      e.end_date,
      e.start_time_included,
      e.end_time_included,
      (e.event_date at time zone 'Europe/Madrid') as local_ts,
      et.id as event_type_id,
      et.code as event_type_code,
      et.name as event_type_name,
      et.icon_path as event_type_icon_path,
      et.color as event_type_color
    from public.event e
    join public.event_type et on et.id = e.event_type_id
  ),
  years as (
    select generate_series(
      extract(year from range_start)::int,
      extract(year from range_end)::int
    ) as yr
  ),
  occurrences as (
    -- NONE: la propia fecha del evento, tal cual.
    select le.*, (le.local_ts)::date as occurrence_date
    from local_events le
    where le.recurrence = 'NONE'

    union all

    -- YEARLY: se proyecta mes/día sobre cada año que cubre el rango.
    select
      le.*,
      make_date(
        y.yr,
        extract(month from le.local_ts)::int,
        least(
          extract(day from le.local_ts)::int,
          extract(day from (
            make_date(y.yr, extract(month from le.local_ts)::int, 1)
            + interval '1 month - 1 day'
          ))::int
        )
      ) as occurrence_date
    from local_events le
    cross join years y
    where le.recurrence = 'YEARLY'
  )
  select
    o.id,
    o.occurrence_date,
    o.title,
    o.description,
    o.place,
    o.image_url,
    o.url,
    o.includes_cromo,
    o.event_date,
    o.end_date,
    o.start_time_included,
    o.end_time_included,
    o.event_type_id,
    o.event_type_code,
    o.event_type_name,
    o.event_type_icon_path,
    o.event_type_color
  from occurrences o
  where o.occurrence_date between range_start and range_end
  order by o.occurrence_date, (o.local_ts)::time, o.id;
$$;

grant execute on function public.events_in_range(date, date) to authenticated;

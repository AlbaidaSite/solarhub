-- =====================================================================
-- CALENDARIO: RPC events_in_range
-- =====================================================================
-- Expande la recurrencia anual para una rejilla de calendario. `range_start`
-- / `range_end` son la rejilla VISIBLE (hasta 42 días, puede cruzar frontera
-- de mes y de año), no el mes en sí — no se asume que compartan año.
--
-- Todas las comparaciones de mes/día se hacen sobre
-- `event_date at time zone 'Europe/Madrid'` (Vercel corre en UTC; sin esto
-- un evento de última hora se dibuja en el día anterior).
--
-- 29 de febrero: se acota el día a la longitud del mes destino
-- (`least(dia, dias_del_mes)`), así un evento anual del 29-F cae en el 29
-- en años bisiestos y en el 28 en años no bisiestos, sin ninguna rama `if`.
--
-- `security invoker` para que respete las políticas RLS existentes sobre
-- `event` (autenticado ve todo, según la política event_select_auth).
-- =====================================================================

create or replace function public.events_in_range(
  range_start date,
  range_end   date
)
returns table (
  id                  integer,
  occurrence_date     date,
  title               text,
  description         text,
  place               text,
  image_url           text,
  url                 text,
  includes_cromo      boolean,
  event_type_id       smallint,
  event_type_code     text,
  event_type_name     text,
  event_type_icon_path text,
  event_type_color    text
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

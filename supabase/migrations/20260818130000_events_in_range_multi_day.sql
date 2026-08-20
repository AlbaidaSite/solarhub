-- =====================================================================
-- CALENDARIO: events_in_range devuelve los eventos de varios días que
-- SOLAPAN el rango, no solo los que empiezan dentro
-- =====================================================================
-- Un evento que dura varios días debe verse en TODOS los días que ocupa
-- (ver groupOccurrencesByDate en eventos/lib/eventOccurrences.ts, que es
-- quien lo reparte por celdas). El reparto lo hace el cliente a partir de
-- occurrence_date y end_date, así que aquí solo hace falta que la fila
-- llegue: con el filtro anterior —`occurrence_date between range_start
-- and range_end`— un evento del 28 de agosto al 3 de septiembre
-- desaparecía por completo al mirar septiembre, porque su fecha de inicio
-- caía fuera de la rejilla de ese mes.
--
-- occurrence_date sigue siendo el día en que EMPIEZA la ocurrencia (para
-- un evento anual, ya proyectado al año que toca): el modal de detalle y
-- los enlaces compartidos dependen de eso.
--
-- El último día se calcula igual que lastDayOfOccurrence en TypeScript, y
-- por el mismo motivo: en un evento YEARLY end_date conserva el año
-- ORIGINAL, así que solo cuenta cuando cae DESPUÉS del día de la
-- ocurrencia. Los dos lados tienen que decir lo mismo o el cliente
-- repartiría por días que el servidor no ha devuelto.
-- =====================================================================

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
  event_type_color     text,
  liked                boolean
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
  ),
  spans as (
    select
      o.*,
      greatest(
        o.occurrence_date,
        coalesce((o.end_date at time zone 'Europe/Madrid')::date, o.occurrence_date)
      ) as last_day
    from occurrences o
  )
  select
    s.id,
    s.occurrence_date,
    s.title,
    s.description,
    s.place,
    s.image_url,
    s.url,
    s.includes_cromo,
    s.event_date,
    s.end_date,
    s.start_time_included,
    s.end_time_included,
    s.event_type_id,
    s.event_type_code,
    s.event_type_name,
    s.event_type_icon_path,
    s.event_type_color,
    exists (
      select 1
      from public.liked_event le
      where le.event_id = s.id
        and le.user_id = auth.uid()
    ) as liked
  from spans s
  -- Solapamiento de intervalos: empieza antes de que acabe el rango y
  -- acaba después de que el rango empiece. Para un evento de un solo día
  -- (last_day = occurrence_date) esto equivale exactamente al `between`
  -- de antes, así que nada de lo que ya funcionaba cambia.
  where s.occurrence_date <= range_end
    and s.last_day >= range_start
  order by s.occurrence_date, (s.local_ts)::time, s.id;
$$;

grant execute on function public.events_in_range(date, date) to authenticated;

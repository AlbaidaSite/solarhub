-- =====================================================================
-- CALENDARIO: recurrencia anual explícita
-- =====================================================================
-- Sustituye `event.is_one_time` (booleano, sin uso en el código de
-- aplicación) por una recurrencia explícita. Hoy el único caso de
-- recurrencia es 'YEARLY' (cumpleaños); se modela como enum para poder
-- añadir más tipos de recurrencia en el futuro sin otra migración de tipo.
-- =====================================================================

create type public.event_recurrence as enum ('NONE', 'YEARLY');

alter table public.event add column recurrence public.event_recurrence;

update public.event
set recurrence = case when is_one_time then 'NONE' else 'YEARLY' end::public.event_recurrence;

alter table public.event alter column recurrence set not null;
alter table public.event alter column recurrence set default 'NONE';

alter table public.event drop column is_one_time;

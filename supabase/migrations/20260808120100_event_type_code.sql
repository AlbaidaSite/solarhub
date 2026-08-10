-- =====================================================================
-- CALENDARIO: código estable de tipo de evento
-- =====================================================================
-- `name` es texto visible y puede cambiar (traducciones, retoques de
-- redacción). La vista de calendario necesita comprobar el tipo de forma
-- estable — por ejemplo "¿es un cumpleaños?" — así que ese chequeo debe
-- hacerse SIEMPRE contra `code`, nunca contra `name`.
--
-- El backfill deriva un candidato razonable a partir de `name`
-- (MAYÚSCULAS_CON_GUION_BAJO). Las filas de event_type se gestionan a mano
-- desde Supabase Studio (ver migración de color, más abajo) — si el
-- resultado del backfill no es exactamente 'BIRTHDAY' para el tipo de
-- cumpleaños, corrígelo a mano tras aplicar esta migración: el código de
-- la vista compara literalmente `code = 'BIRTHDAY'`.
-- =====================================================================

alter table public.event_type add column code text;

update public.event_type
set code = upper(regexp_replace(btrim(name), '[^a-zA-Z0-9]+', '_', 'g'));

alter table public.event_type alter column code set not null;
alter table public.event_type add constraint event_type_code_key unique (code);

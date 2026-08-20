-- =====================================================================
-- HUERTO: garden_work -> plant_bed
-- =====================================================================
-- garden_work modelaba tareas con ventana temporal (planned_start,
-- planned_end, type). El huerto real no necesita eso: necesita saber
-- qué cultivo ocupa qué bancal, ahora mismo o en un plan a futuro. Se
-- renombra la tabla y se le quita la semántica de tarea.
--
-- RENAME TO no arrastra constraints, índices, la secuencia de la PK ni
-- las políticas RLS -- siguen llevando el nombre viejo aunque ya
-- cuelgan de la tabla renombrada. Se corrigen aquí a mano para que el
-- esquema no quede incoherente visto desde el panel de Supabase.
-- =====================================================================

alter table public.garden_work rename to plant_bed;

alter sequence public.garden_work_id_seq rename to plant_bed_id_seq;
alter table public.plant_bed rename constraint garden_work_pkey to plant_bed_pkey;
alter table public.plant_bed rename constraint garden_work_plant_id_fkey to plant_bed_plant_id_fkey;
alter table public.plant_bed rename constraint garden_work_garden_bed_id_fkey to plant_bed_garden_bed_id_fkey;
alter policy garden_work_select_auth on public.plant_bed rename to plant_bed_select_auth;
alter policy garden_work_write_garden_manager on public.plant_bed rename to plant_bed_write_garden_manager;

-- Al dropear planned_start/planned_end se lleva automáticamente (sin
-- CASCADE: son dependientes internos de esta misma tabla) el CHECK
-- garden_work_check (planned_end >= planned_start) y el índice
-- idx_garden_work_dates, que vivía sobre esas dos columnas.
alter table public.plant_bed
  drop column planned_start,
  drop column planned_end,
  drop column type;

drop type public.garden_work_type;

-- La tabla deja de ser "unas pocas tareas puntuales" para llevar el
-- historial de ocupación de cada bancal (actual + planificado): más
-- margen de crecimiento que int2.
alter table public.plant_bed alter column id type integer;
alter sequence public.plant_bed_id_seq as integer;

-- Fila con is_future = true describe una ocupación planificada en vez
-- de la actual (ver bedsForDistribution en la app).
alter table public.plant_bed add column is_future boolean not null default false;

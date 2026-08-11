-- =====================================================================
-- HUERTO: repara las políticas RLS de plant
-- =====================================================================
-- plant tiene RLS activado (desde 20260426160000_role_helpers.sql) pero
-- en algún momento se quedó sin ninguna política -- probablemente al
-- editar la tabla manualmente desde el Table Editor mientras se
-- depuraba la divergencia de tipo de months_of_growth/harvest. Con RLS
-- activado y cero políticas, Postgres deniega todo por defecto salvo al
-- rol admin: por eso el SQL Editor veía las filas (bypassa RLS) y la
-- app no (consulta como authenticated, sin error, solo cero filas).
--
-- garden_bed y plant_bed no se tocan aquí: sus políticas siguen intactas.
-- =====================================================================

drop policy if exists plant_select_auth on public.plant;
drop policy if exists plant_write_garden_manager on public.plant;

alter table public.plant enable row level security;

create policy plant_select_auth
  on public.plant for select to authenticated using (true);

create policy plant_write_garden_manager
  on public.plant for all to authenticated
  using (public.is_garden_manager())
  with check (public.is_garden_manager());

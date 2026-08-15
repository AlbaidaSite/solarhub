-- =====================================================================
-- HUERTO: staff también puede editar la ficha de un cultivo y su diario
-- =====================================================================
-- La ficha de cultivo (PlantModal) deja editar la información de siembra
-- y de recolecta —seed_info / harvest_info y sus meses— y crear, editar
-- o borrar entradas del diario, tanto a garden managers COMO a staff.
--
-- Las políticas de escritura de esas dos tablas solo admitían
-- is_garden_manager (plant en 20260812150000_plant_rls_repair.sql,
-- crop_diary en 20260426160000_role_helpers.sql), así que sin esto un
-- staff vería los botones de editar y el guardado fallaría con un error
-- de RLS: el mismo desajuste entre interfaz y base de datos que ya se
-- corrigió para plant_bed en 20260812170100_plant_bed_write_staff.sql.
--
-- garden_bed se queda como está, exclusiva de garden manager: mover o
-- redimensionar un bancal no lo expone ninguna interfaz todavía.
--
-- is_staff() e is_garden_manager() ya incluyen is_superuser como
-- fallback (ver role_helpers), así que no hace falta añadirlo aquí.
-- =====================================================================

drop policy if exists plant_write_garden_manager on public.plant;

create policy plant_write_garden_manager
  on public.plant for all to authenticated
  using (public.is_garden_manager() or public.is_staff())
  with check (public.is_garden_manager() or public.is_staff());

drop policy if exists crop_diary_write_garden_manager on public.crop_diary;

create policy crop_diary_write_garden_manager
  on public.crop_diary for all to authenticated
  using (public.is_garden_manager() or public.is_staff())
  with check (public.is_garden_manager() or public.is_staff());

-- =====================================================================
-- HUERTO: staff también puede editar los cultivos de un bancal
-- =====================================================================
-- La política de escritura de plant_bed (creada en
-- 20260426160000_role_helpers.sql como garden_work_write_garden_manager
-- y renombrada en 20260811140000) solo admitía is_garden_manager. El
-- modal de bancal abre añadir/editar/eliminar/reordenar a garden
-- managers Y a staff, así que la política tiene que decir lo mismo que
-- la interfaz: si no, el botón se vería y el guardado fallaría con un
-- error de RLS.
--
-- Solo se toca plant_bed, que es lo que edita el modal. plant,
-- garden_bed y crop_diary siguen siendo exclusivas de garden manager:
-- dar de alta una planta nueva o mover un bancal en el lienzo son
-- operaciones de otro nivel y no las expone esta interfaz.
--
-- is_staff() e is_garden_manager() ya incluyen is_superuser como
-- fallback (ver role_helpers), así que no hace falta añadirlo aquí.
-- =====================================================================

drop policy if exists plant_bed_write_garden_manager on public.plant_bed;

create policy plant_bed_write_garden_manager
  on public.plant_bed for all to authenticated
  using (public.is_garden_manager() or public.is_staff())
  with check (public.is_garden_manager() or public.is_staff());

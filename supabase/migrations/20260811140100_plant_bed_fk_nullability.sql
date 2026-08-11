-- =====================================================================
-- HUERTO: nulabilidad de las FK de plant_bed
-- =====================================================================
-- garden_bed_id pasa a NOT NULL: una fila de plant_bed sin bancal no
-- significa nada. plant_id se queda nullable: un bancal preparado u
-- ocupado sin cultivo asignado todavía es un estado válido.
--
-- on delete cascade en garden_bed_id: borrar un bancal se lleva sus
-- ocupaciones. on delete set null en plant_id: borrar una planta deja
-- la ocupación como "sin identificar" en vez de perderla.
-- =====================================================================

alter table public.plant_bed alter column garden_bed_id set not null;

alter table public.plant_bed drop constraint plant_bed_garden_bed_id_fkey;
alter table public.plant_bed add constraint plant_bed_garden_bed_id_fkey
  foreign key (garden_bed_id) references public.garden_bed(id) on delete cascade;

alter table public.plant_bed drop constraint plant_bed_plant_id_fkey;
alter table public.plant_bed add constraint plant_bed_plant_id_fkey
  foreign key (plant_id) references public.plant(id) on delete set null;

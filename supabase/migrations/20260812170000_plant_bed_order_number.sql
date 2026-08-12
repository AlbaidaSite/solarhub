-- =====================================================================
-- HUERTO: orden de los cultivos dentro de un bancal
-- =====================================================================
-- Hasta ahora el orden de los cultivos de un bancal no se guardaba:
-- GardenCanvas los ordenaba por nombre de planta (desempatando por id)
-- solo para que dos renders no intercambiaran los iconos de sitio. Con
-- el modal de bancal ese orden pasa a ser un dato del usuario -- el
-- botón de mover reordena la lista y ese orden dicta en qué subcelda
-- cae cada cultivo -- así que necesita columna propia.
--
-- Mismo nombre que en category.order_number, que ya resuelve este mismo
-- problema en la app.
--
-- Sin UNIQUE sobre (garden_bed_id, is_future, order_number): reordenar
-- es un UPDATE de varias filas a la vez y un índice único no diferible
-- abortaría a mitad de camino por un choque transitorio. El orden se
-- reescribe entero (0..n-1) en cada reordenación, y el desempate por id
-- al leer hace que un empate accidental no cambie nada visible.
-- =====================================================================

alter table public.plant_bed add column order_number smallint not null default 0;

-- Backfill con el orden que la app venía mostrando (nombre de planta,
-- desempatando por id) para que ningún bancal cambie de aspecto al
-- aplicar esta migración. Las filas sin planta (plant_id null) van al
-- final: coalesce a un nombre que ordena después de cualquier otro.
with ordered as (
  select
    pb.id,
    row_number() over (
      partition by pb.garden_bed_id, pb.is_future
      order by coalesce(p.name, chr(255)), pb.id
    ) - 1 as position
  from public.plant_bed pb
  left join public.plant p on p.id = pb.plant_id
)
update public.plant_bed pb
   set order_number = ordered.position
  from ordered
 where ordered.id = pb.id;

-- El orden se lee siempre acotado a un bancal y un modo (actual /
-- planificada), que es justo la partición del backfill de arriba.
create index idx_plant_bed_order
  on public.plant_bed (garden_bed_id, is_future, order_number);

alter table public.plant_bed
  add constraint plant_bed_order_number_non_negative check (order_number >= 0);

-- =====================================================================
-- HUERTO: nivel de riego por bancal
-- =====================================================================
-- Tercera vista del lienzo del huerto, junto a Actual y Planificar (ver
-- ModeToggle.tsx): los mismos bancales en las mismas posiciones, pero
-- mostrando cómo está el riego de cada uno en vez de lo que hay
-- plantado.
--
-- Tabla aparte en vez de una columna en garden_bed, y el motivo es de
-- permisos, no de forma de los datos. garden_bed_write_garden_manager
-- (20260426160000_role_helpers.sql) admite SOLO is_garden_manager. El
-- riego lo cambian garden managers Y staff, igual que los cultivos de un
-- bancal desde 20260812170100_plant_bed_write_staff.sql. Metido como
-- columna de garden_bed habría que abrir esa política a staff, y eso les
-- daría de paso mover y redimensionar bancales, que es otro nivel de
-- operación. Con tabla propia, el riego tiene su política y garden_bed
-- se queda como está.
--
-- Relación 1:1 impuesta por la clave primaria: garden_bed_id ES la PK,
-- así que no hace falta ni un id propio ni un UNIQUE aparte. El borrado
-- de un bancal se lleva su fila por cascada (las acciones de integridad
-- referencial no pasan por RLS, así que no necesita política de DELETE).
--
-- Nombres: el tipo enum se llama igual que la columna a propósito. La
-- app habla de "irrigation_level" en todas partes y Postgres tiene
-- espacios de nombres separados para tipos y columnas, así que
-- `irrigation_level irrigation_level` es válido y evita inventar un
-- sinónimo que luego no case con el código.
--
-- Valores en mayúsculas, como el resto de enums del esquema
-- (garden_work_type, attending_status, media_type).
-- =====================================================================

create type irrigation_level as enum ('ABIERTO', 'BAJO', 'CERRADO');

create table public.irrigation (
  garden_bed_id smallint primary key references public.garden_bed(id) on delete cascade,
  irrigation_level irrigation_level not null default 'CERRADO'
);

-- Toda fila de garden_bed tiene SIEMPRE su fila de riego: la interfaz
-- solo hace UPDATE al cambiar el nivel, nunca INSERT, así que la fila
-- tiene que existir de antemano. Dos piezas para garantizarlo: este
-- backfill para los bancales que ya hay, y el trigger de más abajo para
-- los que se creen a partir de ahora.
--
-- 'CERRADO' es el valor por defecto de la columna, así que basta con
-- insertar la clave: un bancal del que nadie ha dicho nada se lee como
-- riego cerrado.
insert into public.irrigation (garden_bed_id)
select id from public.garden_bed;

-- SECURITY DEFINER porque la tabla tiene RLS y NO hay política de
-- INSERT: nadie inserta a mano, solo este trigger. Mismo patrón que
-- set_has_owners_on_registration y complete_trade_on_mutual_acceptance.
--
-- El on conflict do nothing es defensivo: si alguna vez se vuelve a
-- ejecutar el backfill, o se restaura un bancal con su fila, la
-- inserción no aborta la creación del bancal.
create or replace function public.create_irrigation_for_garden_bed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.irrigation (garden_bed_id)
  values (new.id)
  on conflict (garden_bed_id) do nothing;
  return new;
end;
$$;

create trigger trg_garden_bed_irrigation
  after insert on public.garden_bed
  for each row execute function public.create_irrigation_for_garden_bed();

-- =====================================================================
-- RLS
-- =====================================================================
-- SELECT: cualquier autenticado. La vista de riego es de consulta para
--   todo el mundo; lo que decide quién puede TOCAR un bancal es la
--   política de UPDATE, y la interfaz tiene que decir lo mismo (sin
--   permiso, los bancales no son clicables en esta vista).
-- UPDATE: garden manager o staff, igual que plant_bed.
-- INSERT / DELETE: sin política a propósito. Las altas las hace el
--   trigger de arriba y las bajas la cascada de garden_bed; ningún
--   cliente tiene por qué crear ni borrar filas de riego sueltas.
--
-- is_garden_manager() e is_staff() ya incluyen is_superuser como
-- fallback (ver role_helpers), así que no hace falta añadirlo aquí.
-- =====================================================================

alter table public.irrigation enable row level security;

create policy irrigation_select_auth
  on public.irrigation for select to authenticated
  using (true);

create policy irrigation_update_garden_manager
  on public.irrigation for update to authenticated
  using (public.is_garden_manager() or public.is_staff())
  with check (public.is_garden_manager() or public.is_staff());

-- =====================================================================
-- HUERTO: vocabulario de meses en plant
-- =====================================================================
-- months_of_growth y months_of_harvest eran text[] sin vocabulario
-- definido ("Enero", "enero", "ene", "01"...). La vista de cultivos del
-- mes compara estos arrays contra el mes seleccionado; con valores
-- libres la comparación falla en silencio y las filas salen vacías sin
-- ningún error. Se migra a smallint (1 = enero .. 12 = diciembre).
--
-- __month_text_to_int traduce cualquier valor existente y aborta la
-- migración (excepción) si algo no mapea, en vez de dejarlo como null.
-- =====================================================================

-- Postgres no permite RAISE directamente dentro de una expresión CASE;
-- se envuelve en una función auxiliar para poder usarlo como rama ELSE.
create function public.__raise_unrecognized_month(v text) returns smallint
language plpgsql immutable as $$
begin
  raise exception 'plant.months_*: valor de mes no reconocido: %', v;
end;
$$;

create function public.__month_text_to_int(v text) returns smallint
language plpgsql immutable as $$
declare
  v_norm text := lower(trim(v));
begin
  if v_norm ~ '^([1-9]|1[0-2])$' then
    return v_norm::smallint;
  end if;

  return case v_norm
    when 'enero'      then 1
    when 'febrero'    then 2
    when 'marzo'      then 3
    when 'abril'      then 4
    when 'mayo'       then 5
    when 'junio'      then 6
    when 'julio'      then 7
    when 'agosto'     then 8
    when 'septiembre' then 9
    when 'setiembre'  then 9
    when 'octubre'    then 10
    when 'noviembre'  then 11
    when 'diciembre'  then 12
    else public.__raise_unrecognized_month(v)
  end;
end;
$$;

alter table public.plant
  alter column months_of_growth type smallint[] using (
    case when months_of_growth is null then null
    else (select array_agg(public.__month_text_to_int(e))
            from unnest(months_of_growth) as e) end
  ),
  alter column months_of_harvest type smallint[] using (
    case when months_of_harvest is null then null
    else (select array_agg(public.__month_text_to_int(e))
            from unnest(months_of_harvest) as e) end
  );

drop function public.__month_text_to_int(text);
drop function public.__raise_unrecognized_month(text);

-- Ambas columnas se quedan nullable; la aplicación trata null como
-- '{}' (una planta puede no tener meses declarados).
alter table public.plant
  add constraint plant_months_of_growth_range
    check (months_of_growth <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]),
  add constraint plant_months_of_harvest_range
    check (months_of_harvest <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]);

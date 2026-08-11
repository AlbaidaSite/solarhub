-- =====================================================================
-- HUERTO: vocabulario de meses en plant
-- =====================================================================
-- months_of_growth y months_of_harvest son hoy `text` escalar (no
-- `text[]` como asumía initial_schema.sql -- el esquema real divergió
-- del repo), guardando cosas como "{1,2}" o "1,2" sin vocabulario
-- definido. La vista de cultivos del mes compara estos valores contra
-- el mes seleccionado; con texto libre la comparación falla en
-- silencio y las filas salen vacías sin ningún error. Se migra a
-- smallint[] (1 = enero .. 12 = diciembre).
--
-- __month_text_to_int traduce un valor individual y aborta la
-- migración (excepción) si algo no mapea, en vez de dejarlo como null.
-- __month_text_scalar_to_smallint parte el texto escalar en valores
-- individuales (quitando llaves de literal de array si las hay, p.ej.
-- "{1,2}" -> "1,2" -> [1, 2]) y aplica __month_text_to_int a cada uno.
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

-- Postgres no permite subconsultas dentro de la expresión USING de un
-- ALTER COLUMN ... TYPE ("cannot use subquery in transform expression"),
-- así que el recorrido de valores no puede ir en un
-- "(select array_agg(...) from ...)" ahí mismo: se envuelve en una
-- función que hace el bucle en su propio cuerpo y se llama como una
-- función normal, sin subconsulta, desde el USING.
create function public.__month_text_scalar_to_smallint(v text) returns smallint[]
language plpgsql immutable as $$
declare
  cleaned text;
  parts text[];
  result smallint[] := '{}';
  part text;
begin
  if v is null then
    return null;
  end if;

  -- Quita llaves de literal de array si las hay: '{1,2}' -> '1,2'.
  -- Si no las hay (p.ej. '1,2' o '1' sueltos), se queda igual.
  cleaned := regexp_replace(trim(v), '^\{|\}$', '', 'g');
  if cleaned = '' then
    return '{}'::smallint[];
  end if;

  parts := string_to_array(cleaned, ',');
  foreach part in array parts loop
    result := result || public.__month_text_to_int(trim(part));
  end loop;
  return result;
end;
$$;

alter table public.plant
  alter column months_of_growth type smallint[]
    using public.__month_text_scalar_to_smallint(months_of_growth),
  alter column months_of_harvest type smallint[]
    using public.__month_text_scalar_to_smallint(months_of_harvest);

drop function public.__month_text_scalar_to_smallint(text);
drop function public.__month_text_to_int(text);
drop function public.__raise_unrecognized_month(text);

-- Ambas columnas se quedan nullable; la aplicación trata null como
-- '{}' (una planta puede no tener meses declarados).
alter table public.plant
  add constraint plant_months_of_growth_range
    check (months_of_growth <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]),
  add constraint plant_months_of_harvest_range
    check (months_of_harvest <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]);

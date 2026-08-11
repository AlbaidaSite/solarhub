-- =====================================================================
-- SEED: datos de desarrollo para /huerto
-- =====================================================================
-- Cubre los casos visuales/de datos que rompen la vista (ver issue de
-- /huerto): bancales vacíos, con 1/3/N cultivos, ejes de subdivisión
-- distintos, actual vs. planificada, tamaños límite, vocabulario de
-- meses límite y estados vacíos. Se ejecuta con `supabase db reset`
-- (ver supabase/config.toml, [db.seed].sql_paths).
--
-- Los icon_path apuntan a huerto/<slug>.webp en el bucket
-- solarhub-assets; hay que subir esos archivos aparte (no lo hace esta
-- seed) para que los <image> del lienzo no den 404 en local.
-- =====================================================================

-- ─── plant ──────────────────────────────────────────────────────────
-- Meses usados a propósito: 2-11. Diciembre (12) se deja libre de
-- cualquier planta para cubrir el caso "mes sin actividad".

insert into public.plant (id, name, icon_path, seed_info, harvest_info, months_of_growth, months_of_harvest) values
  (1, 'Ajo',        'huerto/ajo.webp',        'Plantar dientes a 5cm de profundidad.', 'Recolectar cuando las hojas amarilleen.', '{10,11}', '{5,6}'),
  (2, 'Sandía',      'huerto/sandia.webp',     'Necesita mucho espacio y calor.',       'El zarcillo más cercano se seca al madurar.', '{4,5}', '{8,9}'),
  (3, 'Pimiento',    'huerto/pimiento.webp',   'Germina mejor con calor de fondo.',     'Cosechar en verde o dejar madurar en rojo.', '{3,4}', '{7,8,9}'),
  (4, 'Tomate',      'huerto/tomate.webp',     'Entutorar en cuanto arraigue.',         'Recolectar progresivamente según maduran.', '{3,4}', '{7,8}'),
  (5, 'Lechuga',     'huerto/lechuga.webp',    'Siembra escalonada cada 2-3 semanas.',  'Cortar antes de que suba a flor.', '{2,3,8,9}', '{4,5,10,11}'),
  (6, 'Calabaza',    'huerto/calabaza.webp',   'Deja mucho espacio entre plantas.',     'Curar al sol unos días antes de guardar.', '{5}', '{10}'),
  -- Caso: se siembra y se recoge el mismo mes (marzo).
  (7, 'Rabanito',    'huerto/rabanito.webp',   'Ciclo muy corto, apto para principiantes.', 'Listo en unas 3-4 semanas desde la siembra.', '{3}', '{3}'),
  -- Caso: meses vacíos vía NULL -> debe salir en Otros los 12 meses.
  (8, 'Cebolla',     'huerto/cebolla.webp',    null, null, null, null),
  -- Caso: meses vacíos vía '{}' (la otra representación de "sin meses").
  (9, 'Puerro',      'huerto/puerro.webp',     null, null, '{}', '{}'),
  -- Caso: nombre largo, para truncado en PlantRow y en el tooltip del bancal.
  (10, 'Tomate cherry ecológico de la abuela Rosa', 'huerto/tomate-cherry.webp', 'Muy productivo en maceta.', 'Recolectar en racimo cuando estén rojos.', '{6}', '{9}');

-- ─── garden_bed ─────────────────────────────────────────────────────
-- Lienzo de referencia: 100 x 140 (ver GARDEN_CANVAS). Ninguno se
-- solapa; el bancal 9 toca la esquina inferior derecha del lienzo.

insert into public.garden_bed (id, name, width, height, pos_x, pos_y) values
  (1, 'Bancal vacío',                    15, 10, 5,  5),
  (2, 'Bancal con un cultivo',           15, 10, 25, 5),
  (3, 'Bancal con tres cultivos',        18, 10, 45, 5),
  (4, 'Bancal ancho (dos cultivos)',     30, 10, 68, 5),
  (5, 'Bancal alto (dos cultivos)',      10, 30, 5,  40),
  (6, 'Vacío en actual, planificado',    15, 10, 5,  20),
  (7, 'Actual y futuro simultáneos',     15, 10, 25, 20),
  (8, 'Bancal mínimo 1x1',                1,  1, 45, 20),
  (9, 'Bancal pegado al borde',          10, 10, 90, 130);

-- ─── plant_bed ──────────────────────────────────────────────────────

insert into public.plant_bed (id, plant_id, garden_bed_id, description, is_future) values
  -- Bancal 1: vacío a propósito, sin filas.
  -- Bancal 2: un cultivo.
  (1, 4, 2, null, false),
  -- Bancal 3: tres cultivos -> subdivisión en 3 columnas (18x10, ancho >= alto).
  (2, 1, 3, null, false),
  (3, 2, 3, null, false),
  (4, 3, 3, null, false),
  -- Bancal 4: ancho (30x10) con dos cultivos -> columnas verticales.
  (5, 5, 4, null, false),
  (6, 6, 4, null, false),
  -- Bancal 5: alto (10x30) con dos cultivos -> filas horizontales (eje distinto al 4).
  (7, 7, 5, null, false),
  (8, 10, 5, null, false),
  -- Bancal 6: vacío en Actual, ocupado en Planificada.
  (9, 3, 6, 'Previsto para la próxima campaña.', true),
  -- Bancal 7: cultivo actual y otro futuro, plantas distintas (regla de bedsForDistribution).
  (10, 1, 7, null, false),
  (11, 2, 7, 'Sustituirá al ajo cuando se recoja.', true),
  -- Bancal 8: 1x1, el icono debe seguir siendo legible.
  (12, 6, 8, null, false),
  -- Bancal 9: pegado al borde del lienzo.
  (13, 5, 9, null, false);

-- ─── Reset de secuencias ────────────────────────────────────────────
-- Los inserts usan ids explícitos; sin esto, el primer insert hecho
-- desde la app chocaría con la PK.

select setval(pg_get_serial_sequence('public.plant', 'id'), (select max(id) from public.plant));
select setval(pg_get_serial_sequence('public.garden_bed', 'id'), (select max(id) from public.garden_bed));
select setval(pg_get_serial_sequence('public.plant_bed', 'id'), (select max(id) from public.plant_bed));

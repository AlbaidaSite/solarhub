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
--
-- `color` guarda el nombre de clase Tailwind completo, matiz + tono (ver
-- 20260812160000_plant_color.sql). Los valores replican los de producción;
-- las dos plantas sin equivalente allí (Rabanito, Tomate cherry) heredan
-- el color de su pariente (rábano, tomate).

insert into public.plant (id, name, icon_path, seed_info, harvest_info, months_of_growth, months_of_harvest, color) values
  -- Caso: matiz que NO existe en Tailwind ("olive" no está en su paleta) ->
  -- debe caer al color neutro de fallback, no romper ni pintar nada raro.
  (1, 'Ajo',        'huerto/ajo.webp',        'Plantar dientes a 5cm de profundidad.', 'Recolectar cuando las hojas amarilleen.', '{10,11}', '{5,6}', 'olive-400'),
  (2, 'Sandía',      'huerto/sandia.webp',     'Necesita mucho espacio y calor.',       'El zarcillo más cercano se seca al madurar.', '{4,5}', '{8,9}', 'rose-700'),
  (3, 'Pimiento',    'huerto/pimiento.webp',   'Germina mejor con calor de fondo.',     'Cosechar en verde o dejar madurar en rojo.', '{3,4}', '{7,8,9}', 'lime-600'),
  (4, 'Tomate',      'huerto/tomate.webp',     'Entutorar en cuanto arraigue.',         'Recolectar progresivamente según maduran.', '{3,4}', '{7,8}', 'red-700'),
  (5, 'Lechuga',     'huerto/lechuga.webp',    'Siembra escalonada cada 2-3 semanas.',  'Cortar antes de que suba a flor.', '{2,3,8,9}', '{4,5,10,11}', 'lime-600'),
  (6, 'Calabaza',    'huerto/calabaza.webp',   'Deja mucho espacio entre plantas.',     'Curar al sol unos días antes de guardar.', '{5}', '{10}', 'amber-700'),
  -- Caso: se siembra y se recoge el mismo mes (marzo).
  (7, 'Rabanito',    'huerto/rabanito.webp',   'Ciclo muy corto, apto para principiantes.', 'Listo en unas 3-4 semanas desde la siembra.', '{3}', '{3}', 'rose-700'),
  -- Caso: meses vacíos vía NULL -> debe salir en Otros los 12 meses.
  (8, 'Cebolla',     'huerto/cebolla.webp',    null, null, null, null, 'yellow-700'),
  -- Caso: meses vacíos vía '{}' (la otra representación de "sin meses").
  -- También el caso "planta sin color" (color null).
  (9, 'Puerro',      'huerto/puerro.webp',     null, null, '{}', '{}', null),
  -- Caso: nombre largo, para truncado en PlantRow y en el tooltip del bancal.
  (10, 'Tomate cherry ecológico de la abuela Rosa', 'huerto/tomate-cherry.webp', 'Muy productivo en maceta.', 'Recolectar en racimo cuando estén rojos.', '{6}', '{9}', 'red-700');

-- ─── garden_bed ─────────────────────────────────────────────────────
-- Lienzo de referencia: 540 x 810 (ver GARDEN_CANVAS en
-- src/app/(app)/huerto/lib/canvas.ts). Ninguno se solapa; el bancal 10
-- toca la esquina inferior derecha del lienzo.
--
-- Los tamaños están elegidos alrededor de MIN_SUBCELL_SIZE (50, ver
-- lib/subcells.ts): el bancal 3 admite justo 3 cultivos y rechaza el
-- cuarto (180/4 = 45), y el 9 no admite ni el segundo. Sin esto la
-- regla de división mínima no se podría probar en local.
--
-- El bancal 8 es cuadrado de 100: cae exactamente en el límite (100/2 =
-- 50, permitido) y por eso solo admite dos cultivos, siempre en
-- diagonal -- un tercero daría 33 y se rechaza.

insert into public.garden_bed (id, name, width, height, pos_x, pos_y) values
  (1,  'Bancal vacío',                    120,  80,  20,  20),
  (2,  'Bancal con un cultivo',           120,  80, 160,  20),
  (3,  'Bancal con tres cultivos',        180,  80, 300,  20),
  (4,  'Bancal ancho (dos cultivos)',     300, 100,  20, 130),
  (5,  'Bancal alto (dos cultivos)',      100, 300, 350, 130),
  (6,  'Vacío en actual, planificado',    120,  80,  20, 260),
  (7,  'Actual y futuro simultáneos',     120,  80, 160, 260),
  (8,  'Bancal cuadrado (diagonal)',      100, 100,  20, 370),
  (9,  'Bancal mínimo',                    40,  40, 220, 370),
  (10, 'Bancal pegado al borde',          100, 100, 440, 710);

-- ─── plant_bed ──────────────────────────────────────────────────────
-- order_number es el orden DENTRO de cada (bancal, modo): 0, 1, 2… Es
-- lo que dicta qué subcelda ocupa cada cultivo y el orden del listado
-- del modal, así que se numera explícitamente en vez de dejar el
-- default 0 (empatar mandaría el desempate al id y haría el seed
-- ilegible).

insert into public.plant_bed (id, plant_id, garden_bed_id, description, is_future, order_number) values
  -- Bancal 1: vacío a propósito, sin filas.
  -- Bancal 2: un cultivo.
  (1, 4, 2, null, false, 0),
  -- Bancal 3: tres cultivos -> 3 columnas (180x80, ancho >= alto). El Ajo
  -- lleva un color inexistente en Tailwind: aquí se ve el fallback.
  (2, 1, 3, null, false, 0),
  (3, 2, 3, null, false, 1),
  (4, 3, 3, null, false, 2),
  -- Bancal 4: ancho (300x100) con dos cultivos -> columnas verticales.
  (5, 5, 4, null, false, 0),
  (6, 6, 4, null, false, 1),
  -- Bancal 5: alto (100x300) con dos cultivos -> filas horizontales (eje distinto al 4).
  (7, 7, 5, null, false, 0),
  (8, 10, 5, 'Cherry', false, 1),
  -- Bancal 6: vacío en Actual, ocupado en Planificada.
  (9, 3, 6, 'Previsto para la próxima campaña.', true, 0),
  -- Bancal 7: cultivo actual y otro futuro, plantas distintas (regla de bedsForDistribution).
  (10, 1, 7, null, false, 0),
  (11, 2, 7, 'Sustituirá al ajo cuando se recoja.', true, 0),
  -- Bancal 8: cuadrado con dos cultivos -> corte diagonal.
  (12, 4, 8, 'De pera', false, 0),
  (13, 8, 8, null, false, 1),
  -- Bancal 9: el más pequeño que admite cultivo; el Puerro no tiene color
  -- (color null) -> otro camino hasta el color de fallback.
  (14, 9, 9, null, false, 0),
  -- Bancal 10: pegado al borde del lienzo.
  (15, 5, 10, null, false, 0);

-- ─── Reset de secuencias ────────────────────────────────────────────
-- Los inserts usan ids explícitos; sin esto, el primer insert hecho
-- desde la app chocaría con la PK.

select setval(pg_get_serial_sequence('public.plant', 'id'), (select max(id) from public.plant));
select setval(pg_get_serial_sequence('public.garden_bed', 'id'), (select max(id) from public.garden_bed));
select setval(pg_get_serial_sequence('public.plant_bed', 'id'), (select max(id) from public.plant_bed));

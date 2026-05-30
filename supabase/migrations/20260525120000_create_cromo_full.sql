-- =====================================================================
-- create_cromo_full(...)
--
-- Hace en una sola transacción todos los inserts que la action
-- `createCromoAction` (staff/cromos/crear) hacía paso a paso con un
-- rollback manual en TS. El cliente sigue ocupándose de:
--   1. Validar campos + subir las dos imágenes a Storage.
--   2. Llamar a esta RPC con las rutas resultantes.
--   3. Si la RPC devuelve { ok: false }, borrar los ficheros subidos.
--
-- La función devuelve siempre jsonb (nunca lanza al cliente):
--   éxito → { ok: true,  cromo_id: <int> }
--   fallo → { ok: false, error:   <text> }
-- =====================================================================

CREATE OR REPLACE FUNCTION public.create_cromo_full(
  p_name            text,
  p_description     text,
  p_number          int,
  p_variant         int,
  p_category_id     int,
  p_rarity_id       int,
  p_how_to          text,
  p_how_to_extended text,
  p_copies          int,
  p_allow_multiple  boolean,
  p_for_loukou      boolean,
  p_front_img       text,
  p_back_img        text,
  p_artist_ids      int[],
  p_codes           int[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_labels_id int;
  v_cromo_id  int;
  v_conflicts int[];
BEGIN
  IF NOT public.is_staff() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado.');
  END IF;

  IF COALESCE(array_length(p_codes, 1), 0) <> p_copies THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Codes desincronizados con copias.'
    );
  END IF;

  -- Conflict check: codes ya en uso en esta categoría.
  -- Se hace antes de los inserts para devolver la lista completa de codes
  -- en conflicto y no solo el primero (que es lo que detectaría la unique
  -- constraint).
  SELECT array_agg(uc.code ORDER BY uc.code)
  INTO   v_conflicts
  FROM   unique_cromo uc
  JOIN   cromo c ON c.id = uc.cromo_id
  WHERE  c.category_id = p_category_id
    AND  uc.code = ANY(p_codes);

  IF v_conflicts IS NOT NULL AND cardinality(v_conflicts) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      'Los siguientes codes ya existen en esta categoría: '
        || array_to_string(v_conflicts, ', ')
    );
  END IF;

  -- Inserts atómicos: el bloque BEGIN/EXCEPTION es una subtransacción,
  -- cualquier error rompe TODO lo hecho hasta este punto.
  INSERT INTO cromo_labels (
    has_owners, hide_til_registered, for_loukou, allow_multiple_users
  )
  VALUES (false, false, p_for_loukou, p_allow_multiple)
  RETURNING id INTO v_labels_id;

  INSERT INTO cromo (
    category_id, rarity_id, labels_id, name,
    front_img, back_img, description,
    number, variant, copies,
    how_to, how_to_extended
  )
  VALUES (
    p_category_id, p_rarity_id, v_labels_id, p_name,
    p_front_img, p_back_img, p_description,
    p_number, p_variant, p_copies,
    p_how_to, p_how_to_extended
  )
  RETURNING id INTO v_cromo_id;

  IF COALESCE(array_length(p_artist_ids, 1), 0) > 0 THEN
    INSERT INTO cromo_artist (cromo_id, artist_id)
    SELECT v_cromo_id, unnest(p_artist_ids);
  END IF;

  -- copy_number 1..N viene de WITH ORDINALITY sobre el array de codes.
  INSERT INTO unique_cromo (cromo_id, code, copy_number)
  SELECT v_cromo_id, c.code, c.copy_number
  FROM   unnest(p_codes) WITH ORDINALITY AS c(code, copy_number);

  RETURN jsonb_build_object('ok', true, 'cromo_id', v_cromo_id);

EXCEPTION
  WHEN unique_violation THEN
    IF SQLERRM ILIKE '%cromo_category_id_number_variant_key%' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Ya existe un cromo con este número en esta categoría. ¿Es esto una variante?'
      );
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Error creando cromo: ' || SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_cromo_full(
  text, text, int, int, int, int, text, text,
  int, boolean, boolean, text, text, int[], int[]
) TO authenticated;

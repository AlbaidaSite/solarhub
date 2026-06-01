-- =====================================================================
-- update_cromo_full(...)
--
-- Versión RPC de la action `updateCromoAction`. Sustituye 6 operaciones
-- DB encadenadas en TS por una sola transacción atómica. El cliente
-- gestiona aún la subida opcional de imágenes y pasa las rutas finales
-- (las nuevas si se han subido, las actuales si no).
--
-- Devuelve siempre jsonb:
--   éxito → { ok: true }
--   fallo → { ok: false, error: <text> }
-- =====================================================================

CREATE OR REPLACE FUNCTION public.update_cromo_full(
  p_cromo_id        int,
  p_labels_id       int,
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

  UPDATE cromo_labels
  SET    allow_multiple_users = p_allow_multiple,
         for_loukou           = p_for_loukou
  WHERE  id = p_labels_id;

  UPDATE cromo
  SET    category_id     = p_category_id,
         rarity_id       = p_rarity_id,
         name            = p_name,
         front_img       = p_front_img,
         back_img        = p_back_img,
         description     = p_description,
         number          = p_number,
         variant         = p_variant,
         copies          = p_copies,
         how_to          = p_how_to,
         how_to_extended = p_how_to_extended
  WHERE  id = p_cromo_id;

  -- cromo_artist: borramos todos y reinsertamos los nuevos. Más simple
  -- que diffear y suficiente porque la tabla es solo un join.
  DELETE FROM cromo_artist WHERE cromo_id = p_cromo_id;

  IF COALESCE(array_length(p_artist_ids, 1), 0) > 0 THEN
    INSERT INTO cromo_artist (cromo_id, artist_id)
    SELECT p_cromo_id, unnest(p_artist_ids);
  END IF;

  -- 1) borrar las filas que ya no entran tras reducir copies.
  DELETE FROM unique_cromo
  WHERE  cromo_id   = p_cromo_id
    AND  copy_number > p_copies;

  -- 2) upsert del listado final, indexado por (cromo_id, copy_number).
  --    El conflicto entre copies dentro del mismo cromo lo evita la
  --    unique constraint (cromo_id, copy_number); el conflicto cross-
  --    cromo por mismo code en misma categoría lo gestiona unique_cromo.
  INSERT INTO unique_cromo (cromo_id, code, copy_number)
  SELECT p_cromo_id, c.code, c.copy_number
  FROM   unnest(p_codes) WITH ORDINALITY AS c(code, copy_number)
  ON CONFLICT (cromo_id, copy_number) DO UPDATE
    SET code = EXCLUDED.code;

  RETURN jsonb_build_object('ok', true);

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
      'error', 'Error actualizando cromo: ' || SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_cromo_full(
  int, int, text, text, int, int, int, int, text, text,
  int, boolean, boolean, text, text, int[], int[]
) TO authenticated;

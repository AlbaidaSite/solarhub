-- =====================================================================
-- start_trade(p_other_user_id)
--
-- Sustituye al rollback manual de `startTradeAction`:
--   * Si ya existe un trade abierto entre los dos usuarios, lo reusa.
--   * Si no, crea trade + 2 filas en trade_offer en una sola transacción.
--
-- Devuelve siempre jsonb:
--   éxito → { ok: true,  trade_id: <int> }
--   fallo → { ok: false, error:    <text> }
-- =====================================================================

CREATE OR REPLACE FUNCTION public.start_trade(p_other_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_trade_id int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autenticado.');
  END IF;

  IF v_user_id = p_other_user_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'No puedes intercambiar contigo mismo.'
    );
  END IF;

  -- Reutilizar trade existente entre estos dos usuarios (cualquier dirección).
  SELECT id INTO v_trade_id
  FROM   trade
  WHERE  is_mutual_agreement = false
    AND  ((initiator_id = v_user_id        AND recipient_id = p_other_user_id)
       OR (initiator_id = p_other_user_id  AND recipient_id = v_user_id))
  LIMIT  1;

  IF v_trade_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'trade_id', v_trade_id);
  END IF;

  INSERT INTO trade (initiator_id, recipient_id)
  VALUES (v_user_id, p_other_user_id)
  RETURNING id INTO v_trade_id;

  INSERT INTO trade_offer (trade_id, user_id)
  VALUES (v_trade_id, v_user_id),
         (v_trade_id, p_other_user_id);

  RETURN jsonb_build_object('ok', true, 'trade_id', v_trade_id);

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Error creando intercambio: ' || SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_trade(uuid) TO authenticated;

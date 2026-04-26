-- =====================================================================
-- A. profile.username UNIQUE CASE-INSENSITIVE
-- Sustituye el UNIQUE sensible a mayúsculas por un índice único sobre
-- lower(username), de forma que el enforcement coincide con la RPC
-- public.username_exists().
-- =====================================================================

ALTER TABLE profile DROP CONSTRAINT IF EXISTS profile_username_key;

CREATE UNIQUE INDEX IF NOT EXISTS profile_username_lower_uniq
  ON profile (lower(username));


-- =====================================================================
-- B. AUTO-CREAR credentials AL INSERTAR profile
-- Garantiza que todo profile tenga su fila de credentials con todos
-- los flags en false (los DEFAULT de la tabla). Elimina la necesidad
-- de un INSERT explícito desde el cliente y previene profiles huérfanos
-- si la red falla a mitad del registro.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.create_credentials_for_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.credentials (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_credentials_for_profile ON public.profile;

CREATE TRIGGER trg_create_credentials_for_profile
  AFTER INSERT ON public.profile
  FOR EACH ROW
  EXECUTE FUNCTION public.create_credentials_for_profile();

-- Backfill de profiles ya existentes que no tengan credentials
INSERT INTO public.credentials (user_id)
SELECT p.id
  FROM public.profile p
 WHERE NOT EXISTS (
        SELECT 1 FROM public.credentials c WHERE c.user_id = p.id
      );


-- =====================================================================
-- D. VALIDAR unique_cromo.copy_number CONTRA cromo.copies
-- Impide que se creen unique_cromos con copy_number fuera del rango
-- [1, cromo.copies].
-- =====================================================================

ALTER TABLE unique_cromo
  ADD CONSTRAINT unique_cromo_copy_number_positive
  CHECK (copy_number >= 1);

CREATE OR REPLACE FUNCTION public.validate_unique_cromo_copy_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_copies smallint;
BEGIN
  SELECT copies INTO v_copies FROM cromo WHERE id = NEW.cromo_id;

  IF NEW.copy_number > v_copies THEN
    RAISE EXCEPTION
      'copy_number % excede el máximo (% copias) para el cromo %',
      NEW.copy_number, v_copies, NEW.cromo_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_unique_cromo_copy_number
  ON public.unique_cromo;

CREATE TRIGGER trg_validate_unique_cromo_copy_number
  BEFORE INSERT OR UPDATE OF copy_number, cromo_id ON public.unique_cromo
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_unique_cromo_copy_number();


-- =====================================================================
-- E. CIERRE AUTOMÁTICO DE TRADE Y TRANSFERENCIA DE UNIQUES
-- Cuando todas las trade_offer.is_accepted de un trade pasan a true:
--   1. Marca trade.is_mutual_agreement = true
--   2. Cierra el current_owner anterior de cada unique implicado
--   3. Inserta nuevo current_owner cruzado (los uniques del initiator
--      pasan al recipient y viceversa)
-- Si el trade ya estaba cerrado (is_mutual_agreement = true) no hace
-- nada, para no re-transferir si las aceptaciones se reactivan tras
-- modificar trade_unique.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.complete_trade_on_mutual_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade_id        smallint;
  v_initiator       uuid;
  v_recipient       uuid;
  v_already_settled boolean;
  v_all_accepted    boolean;
BEGIN
  -- Solo nos interesa la transición a is_accepted = true
  IF NEW.is_accepted IS NOT TRUE OR OLD.is_accepted IS TRUE THEN
    RETURN NEW;
  END IF;

  v_trade_id := NEW.trade_id;

  SELECT is_mutual_agreement, initiator_id, recipient_id
    INTO v_already_settled, v_initiator, v_recipient
    FROM trade
   WHERE id = v_trade_id;

  -- Trade ya cerrado: no re-transferir
  IF v_already_settled THEN
    RETURN NEW;
  END IF;

  -- ¿Están todas las ofertas aceptadas?
  SELECT bool_and(is_accepted) INTO v_all_accepted
    FROM trade_offer
   WHERE trade_id = v_trade_id;

  IF NOT v_all_accepted THEN
    RETURN NEW;
  END IF;

  -- 1. Marcar el trade como cerrado
  UPDATE trade
     SET is_mutual_agreement = true
   WHERE id = v_trade_id;

  -- 2. Cerrar los current owners anteriores de los uniques implicados
  UPDATE unique_ownership uo
     SET is_current_owner = false
   WHERE uo.is_current_owner = true
     AND uo.unique_id IN (
           SELECT tu.unique_id
             FROM trade_unique tu
             JOIN trade_offer tof ON tof.id = tu.trade_offer_id
            WHERE tof.trade_id = v_trade_id
         );

  -- 3. Insertar nuevos current owners cruzados
  INSERT INTO unique_ownership (unique_id, user_id, is_current_owner)
  SELECT
      tu.unique_id,
      CASE WHEN tof.user_id = v_initiator THEN v_recipient ELSE v_initiator END,
      true
    FROM trade_unique tu
    JOIN trade_offer tof ON tof.id = tu.trade_offer_id
   WHERE tof.trade_id = v_trade_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complete_trade_on_mutual_acceptance
  ON public.trade_offer;

CREATE TRIGGER trg_complete_trade_on_mutual_acceptance
  AFTER UPDATE OF is_accepted ON public.trade_offer
  FOR EACH ROW
  EXECUTE FUNCTION public.complete_trade_on_mutual_acceptance();

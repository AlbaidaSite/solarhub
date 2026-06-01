-- =====================================================================
-- ROW LEVEL SECURITY — TABLAS RESTANTES
-- =====================================================================
-- Activa RLS en las 19 tablas que seguían como "Unrestricted" y define
-- sus políticas. Sin RLS, cualquier cliente con la anon key puede
-- leer/escribir saltándose el frontend y los server actions.
--
-- Patrón de roles (helpers SECURITY DEFINER ya existentes):
--   is_staff()        -> staff OR superuser
--   is_superuser()    -> superuser
--   is_garden_manager -> garden_manager OR superuser
--
-- Decisiones de producto (confirmadas):
--   * Colección (unique_ownership): visible a todos los autenticados.
--   * Asistentes (attending):       visibles a todos los autenticados.
--   * Logros / puntuaciones:        públicos entre autenticados.
--
-- Las transferencias de propiedad y el cierre de trades ocurren vía
-- triggers SECURITY DEFINER (complete_trade_on_mutual_acceptance,
-- set_has_owners_on_registration), que saltan RLS. La creación de
-- cromos/uniques va vía create_cromo_full (SECURITY DEFINER).
-- =====================================================================


-- =====================================================================
-- FIX PREVIO: reset_trade_acceptance() -> SECURITY DEFINER
-- Este trigger resetea is_accepted = false en AMBAS ofertas del trade
-- cuando se modifica la lista de uniques. Con RLS, un usuario solo
-- podría actualizar su propia oferta (trade_offer_update_own), dejando
-- la del otro participante obsoleta y permitiendo cierres prematuros.
-- Como DEFINER salta RLS y puede resetear ambas. La lógica no cambia.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.reset_trade_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade_id smallint;
BEGIN
  SELECT trade_id INTO v_trade_id
  FROM trade_offer
  WHERE id = COALESCE(NEW.trade_offer_id, OLD.trade_offer_id);

  UPDATE trade_offer
  SET is_accepted = false
  WHERE trade_id = v_trade_id;

  RETURN NULL;
END;
$$;


-- =====================================================================
-- HELPER: is_trade_participant(p_trade_id)
-- True si auth.uid() es initiator o recipient del trade. SECURITY
-- DEFINER para que las políticas de trade_offer / trade_unique puedan
-- comprobar participación sin depender de la visibilidad RLS de `trade`.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_trade_participant(p_trade_id smallint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM trade t
     WHERE t.id = p_trade_id
       AND (t.initiator_id = auth.uid() OR t.recipient_id = auth.uid())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_trade_participant(smallint) TO authenticated;


-- =====================================================================
-- CATÁLOGOS: lectura libre para autenticados, escritura solo staff.
-- (event_type, game, achievement, country, game_achievement)
-- =====================================================================

ALTER TABLE public.event_type ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_type_select_auth ON public.event_type;
DROP POLICY IF EXISTS event_type_write_staff ON public.event_type;
CREATE POLICY event_type_select_auth
  ON public.event_type FOR SELECT TO authenticated USING (true);
CREATE POLICY event_type_write_staff
  ON public.event_type FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

ALTER TABLE public.game ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS game_select_auth ON public.game;
DROP POLICY IF EXISTS game_write_staff ON public.game;
CREATE POLICY game_select_auth
  ON public.game FOR SELECT TO authenticated USING (true);
CREATE POLICY game_write_staff
  ON public.game FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

ALTER TABLE public.achievement ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS achievement_select_auth ON public.achievement;
DROP POLICY IF EXISTS achievement_write_staff ON public.achievement;
CREATE POLICY achievement_select_auth
  ON public.achievement FOR SELECT TO authenticated USING (true);
CREATE POLICY achievement_write_staff
  ON public.achievement FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

ALTER TABLE public.country ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS country_select_auth ON public.country;
DROP POLICY IF EXISTS country_write_staff ON public.country;
CREATE POLICY country_select_auth
  ON public.country FOR SELECT TO authenticated USING (true);
CREATE POLICY country_write_staff
  ON public.country FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

ALTER TABLE public.game_achievement ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS game_achievement_select_auth ON public.game_achievement;
DROP POLICY IF EXISTS game_achievement_write_staff ON public.game_achievement;
CREATE POLICY game_achievement_select_auth
  ON public.game_achievement FOR SELECT TO authenticated USING (true);
CREATE POLICY game_achievement_write_staff
  ON public.game_achievement FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());


-- =====================================================================
-- CROMOS: copias únicas y propiedad
-- =====================================================================

-- unique_cromo: catálogo de copias. Lectura auth (registro/intercambio
-- buscan por code). Escritura staff (la creación real va por
-- create_cromo_full SECURITY DEFINER, que salta RLS).
ALTER TABLE public.unique_cromo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS unique_cromo_select_auth ON public.unique_cromo;
DROP POLICY IF EXISTS unique_cromo_write_staff ON public.unique_cromo;
CREATE POLICY unique_cromo_select_auth
  ON public.unique_cromo FOR SELECT TO authenticated USING (true);
CREATE POLICY unique_cromo_write_staff
  ON public.unique_cromo FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- unique_reserved_code: datos sensibles de administración. Solo staff.
ALTER TABLE public.unique_reserved_code ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS unique_reserved_code_staff ON public.unique_reserved_code;
CREATE POLICY unique_reserved_code_staff
  ON public.unique_reserved_code FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- unique_ownership:
--   SELECT  -> todos los autenticados (colección pública + necesario
--              para que validate_single_current_owner cuente bien).
--   INSERT  -> solo para ti mismo (registro de un cromo).
--   UPDATE/DELETE desde cliente: NO. Las transferencias las hace
--   complete_trade_on_mutual_acceptance (SECURITY DEFINER).
ALTER TABLE public.unique_ownership ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS unique_ownership_select_auth ON public.unique_ownership;
DROP POLICY IF EXISTS unique_ownership_insert_self ON public.unique_ownership;
CREATE POLICY unique_ownership_select_auth
  ON public.unique_ownership FOR SELECT TO authenticated USING (true);
CREATE POLICY unique_ownership_insert_self
  ON public.unique_ownership FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());


-- =====================================================================
-- TRADES: solo participantes (y staff)
-- INSERT trade / trade_offer -> via start_trade() SECURITY DEFINER.
-- UPDATE trade / transferencias -> via triggers SECURITY DEFINER.
-- =====================================================================

ALTER TABLE public.trade ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trade_select_participant ON public.trade;
CREATE POLICY trade_select_participant
  ON public.trade FOR SELECT TO authenticated
  USING (
    initiator_id = auth.uid()
    OR recipient_id = auth.uid()
    OR public.is_staff()
  );

-- trade_offer: ver ambas ofertas si eres participante; actualizar solo
-- la tuya (aceptar/rechazar). INSERT lo hace start_trade (definer).
ALTER TABLE public.trade_offer ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trade_offer_select_participant ON public.trade_offer;
DROP POLICY IF EXISTS trade_offer_update_own ON public.trade_offer;
CREATE POLICY trade_offer_select_participant
  ON public.trade_offer FOR SELECT TO authenticated
  USING (public.is_trade_participant(trade_id) OR public.is_staff());
CREATE POLICY trade_offer_update_own
  ON public.trade_offer FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- trade_unique: ver los uniques de ambas ofertas si eres participante;
-- añadir/quitar solo en TU propia oferta.
ALTER TABLE public.trade_unique ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trade_unique_select_participant ON public.trade_unique;
DROP POLICY IF EXISTS trade_unique_insert_own_offer ON public.trade_unique;
DROP POLICY IF EXISTS trade_unique_delete_own_offer ON public.trade_unique;
CREATE POLICY trade_unique_select_participant
  ON public.trade_unique FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trade_offer tof
       WHERE tof.id = trade_unique.trade_offer_id
         AND public.is_trade_participant(tof.trade_id)
    )
    OR public.is_staff()
  );
CREATE POLICY trade_unique_insert_own_offer
  ON public.trade_unique FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trade_offer tof
       WHERE tof.id = trade_unique.trade_offer_id
         AND tof.user_id = auth.uid()
    )
  );
CREATE POLICY trade_unique_delete_own_offer
  ON public.trade_unique FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trade_offer tof
       WHERE tof.id = trade_unique.trade_offer_id
         AND tof.user_id = auth.uid()
    )
  );


-- =====================================================================
-- MAPA: pin y map_media
-- Lectura para todos los autenticados. Crear: cualquiera (para sí).
-- Editar/Borrar: el creador, staff o superuser (is_staff() ya cubre
-- staff OR superuser).
-- =====================================================================

ALTER TABLE public.pin ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pin_select_auth ON public.pin;
DROP POLICY IF EXISTS pin_insert_self ON public.pin;
DROP POLICY IF EXISTS pin_update_owner_or_staff ON public.pin;
DROP POLICY IF EXISTS pin_delete_owner_or_staff ON public.pin;
CREATE POLICY pin_select_auth
  ON public.pin FOR SELECT TO authenticated USING (true);
CREATE POLICY pin_insert_self
  ON public.pin FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY pin_update_owner_or_staff
  ON public.pin FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_staff());
CREATE POLICY pin_delete_owner_or_staff
  ON public.pin FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

-- map_media: hereda permiso del pin padre.
ALTER TABLE public.map_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS map_media_select_auth ON public.map_media;
DROP POLICY IF EXISTS map_media_insert_pin_owner ON public.map_media;
DROP POLICY IF EXISTS map_media_delete_pin_owner ON public.map_media;
CREATE POLICY map_media_select_auth
  ON public.map_media FOR SELECT TO authenticated USING (true);
CREATE POLICY map_media_insert_pin_owner
  ON public.map_media FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pin p
       WHERE p.id = map_media.pin_id
         AND (p.user_id = auth.uid() OR public.is_staff())
    )
  );
CREATE POLICY map_media_delete_pin_owner
  ON public.map_media FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pin p
       WHERE p.id = map_media.pin_id
         AND (p.user_id = auth.uid() OR public.is_staff())
    )
  );


-- =====================================================================
-- CALENDARIO: event, event_price, attending
-- event: leer todos; crear cualquiera (para sí); editar/borrar
--        creador o staff. event_price hereda del event padre.
-- attending: leer todos; gestionar solo la tuya.
-- =====================================================================

ALTER TABLE public.event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_select_auth ON public.event;
DROP POLICY IF EXISTS event_insert_self ON public.event;
DROP POLICY IF EXISTS event_update_owner_or_staff ON public.event;
DROP POLICY IF EXISTS event_delete_owner_or_staff ON public.event;
CREATE POLICY event_select_auth
  ON public.event FOR SELECT TO authenticated USING (true);
CREATE POLICY event_insert_self
  ON public.event FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY event_update_owner_or_staff
  ON public.event FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_staff());
CREATE POLICY event_delete_owner_or_staff
  ON public.event FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

-- event_price: hereda permiso del event padre.
ALTER TABLE public.event_price ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_price_select_auth ON public.event_price;
DROP POLICY IF EXISTS event_price_write_event_owner ON public.event_price;
CREATE POLICY event_price_select_auth
  ON public.event_price FOR SELECT TO authenticated USING (true);
CREATE POLICY event_price_write_event_owner
  ON public.event_price FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.event e
       WHERE e.id = event_price.event_id
         AND (e.user_id = auth.uid() OR public.is_staff())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event e
       WHERE e.id = event_price.event_id
         AND (e.user_id = auth.uid() OR public.is_staff())
    )
  );

-- attending: lista visible a todos; cada quien gestiona la suya.
ALTER TABLE public.attending ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attending_select_auth ON public.attending;
DROP POLICY IF EXISTS attending_insert_self ON public.attending;
DROP POLICY IF EXISTS attending_update_self ON public.attending;
DROP POLICY IF EXISTS attending_delete_self ON public.attending;
CREATE POLICY attending_select_auth
  ON public.attending FOR SELECT TO authenticated USING (true);
CREATE POLICY attending_insert_self
  ON public.attending FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY attending_update_self
  ON public.attending FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY attending_delete_self
  ON public.attending FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- =====================================================================
-- JUEGOS: game_saved_data, game_score, user_achievement
-- =====================================================================

-- game_saved_data: privado, solo el dueño lee y escribe.
ALTER TABLE public.game_saved_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS game_saved_data_own ON public.game_saved_data;
CREATE POLICY game_saved_data_own
  ON public.game_saved_data FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- game_score: leaderboard público entre autenticados; insertas la tuya.
-- (sin UPDATE/DELETE desde cliente: las puntuaciones son inmutables)
ALTER TABLE public.game_score ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS game_score_select_auth ON public.game_score;
DROP POLICY IF EXISTS game_score_insert_self ON public.game_score;
CREATE POLICY game_score_select_auth
  ON public.game_score FOR SELECT TO authenticated USING (true);
CREATE POLICY game_score_insert_self
  ON public.game_score FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- user_achievement: insignias visibles a todos; la concesión la hace
-- staff o un trigger SECURITY DEFINER (cuando se implemente). Sin
-- escritura libre desde cliente para no auto-otorgarse logros.
ALTER TABLE public.user_achievement ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_achievement_select_auth ON public.user_achievement;
DROP POLICY IF EXISTS user_achievement_write_staff ON public.user_achievement;
CREATE POLICY user_achievement_select_auth
  ON public.user_achievement FOR SELECT TO authenticated USING (true);
CREATE POLICY user_achievement_write_staff
  ON public.user_achievement FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

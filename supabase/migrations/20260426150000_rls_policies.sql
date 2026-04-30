-- =====================================================================
-- ROW LEVEL SECURITY
-- Activa RLS en las tablas críticas y define políticas mínimas.
-- Sin RLS, cualquier cliente con la anon key puede leer/escribir
-- saltándose el middleware del frontend. Esto es la única defensa
-- a nivel de datos.
-- =====================================================================


-- =====================================================================
-- HELPER: is_staff()
-- Devuelve true si el usuario actual tiene flag de staff o superuser.
-- SECURITY DEFINER para evitar recursión: la propia consulta a
-- credentials saltará RLS, así no necesitas darte permiso a ti mismo
-- para usar tus propios flags.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT (c.is_staff OR c.is_superuser)
      FROM credentials c
     WHERE c.user_id = auth.uid()
  ), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;


-- =====================================================================
-- profile
-- =====================================================================

ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;

-- Cualquier autenticado puede leer perfiles (necesario para mostrar
-- usernames/avatares en cromos, trades, mapa, etc.)
CREATE POLICY profile_select_authenticated
  ON public.profile FOR SELECT
  TO authenticated
  USING (true);

-- Solo puedes crear tu propio profile (id = tu auth.uid())
CREATE POLICY profile_insert_self
  ON public.profile FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Solo puedes editar tu propio profile
CREATE POLICY profile_update_self
  ON public.profile FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- DELETE no se permite desde cliente; el cascade desde auth.users
-- limpia automáticamente.


-- =====================================================================
-- credentials
-- =====================================================================

ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

-- Lees tus propias credenciales (para que la app sepa si eres
-- staff/loukou/etc.) o cualquiera si eres staff.
CREATE POLICY credentials_select_self_or_staff
  ON public.credentials FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

-- Solo staff puede modificar flags. Bloqueas la auto-promoción.
CREATE POLICY credentials_update_staff_only
  ON public.credentials FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- INSERT solo via trg_create_credentials_for_profile (SECURITY DEFINER → salta RLS)
-- DELETE: cascade desde profile/auth.users


-- =====================================================================
-- request
-- =====================================================================

ALTER TABLE public.request ENABLE ROW LEVEL SECURITY;

-- Ves tu solicitud o todas si eres staff
CREATE POLICY request_select_self_or_staff
  ON public.request FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

-- Creas solicitud solo para ti mismo (el flujo de registro)
CREATE POLICY request_insert_self
  ON public.request FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Solo staff aprueba/rechaza. Disparará trg_activate_credentials_on_request_approval
CREATE POLICY request_update_staff
  ON public.request FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());


-- =====================================================================
-- CATÁLOGOS DE CROMOS
-- Lectura libre para autenticados (la app entera los necesita),
-- escritura solo staff.
-- =====================================================================

ALTER TABLE public.cromo ENABLE ROW LEVEL SECURITY;
CREATE POLICY cromo_select_auth
  ON public.cromo FOR SELECT TO authenticated USING (true);
CREATE POLICY cromo_write_staff
  ON public.cromo FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

ALTER TABLE public.cromo_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY cromo_labels_select_auth
  ON public.cromo_labels FOR SELECT TO authenticated USING (true);
CREATE POLICY cromo_labels_write_staff
  ON public.cromo_labels FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

ALTER TABLE public.rarity ENABLE ROW LEVEL SECURITY;
CREATE POLICY rarity_select_auth
  ON public.rarity FOR SELECT TO authenticated USING (true);
CREATE POLICY rarity_write_staff
  ON public.rarity FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

ALTER TABLE public.category ENABLE ROW LEVEL SECURITY;
CREATE POLICY category_select_auth
  ON public.category FOR SELECT TO authenticated USING (true);
CREATE POLICY category_write_staff
  ON public.category FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

ALTER TABLE public.artist ENABLE ROW LEVEL SECURITY;
CREATE POLICY artist_select_auth
  ON public.artist FOR SELECT TO authenticated USING (true);
CREATE POLICY artist_write_staff
  ON public.artist FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

ALTER TABLE public.cromo_artist ENABLE ROW LEVEL SECURITY;
CREATE POLICY cromo_artist_select_auth
  ON public.cromo_artist FOR SELECT TO authenticated USING (true);
CREATE POLICY cromo_artist_write_staff
  ON public.cromo_artist FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());


-- =====================================================================
-- TODO: políticas pendientes (cuando montes esas vistas)
--
-- unique_cromo, unique_ownership, unique_reserved_code:
--   - SELECT auth: posiblemente sí (la colección es semi-pública)
--   - INSERT/UPDATE: solo staff (las transferencias las hace el trigger
--     trg_complete_trade_on_mutual_acceptance que es SECURITY DEFINER)
--
-- trade, trade_offer, trade_unique:
--   - Solo participantes ven/modifican: USING (auth.uid() IN (
--       SELECT initiator_id FROM trade WHERE id = trade_id
--       UNION SELECT recipient_id FROM trade WHERE id = trade_id))
--
-- pin, map_media, sticker, country:
--   - SELECT auth para todos
--   - INSERT/UPDATE/DELETE: solo el user_id que sube el pin
--
-- event, event_price, event_type, attending:
--   - SELECT auth para todos los activos
--   - INSERT eventos: staff
--   - INSERT attending: solo para tu propio user_id
--
-- game, game_saved_data, game_score, achievement,
-- game_achievement, user_achievement:
--   - Catálogos (game, achievement, game_achievement): SELECT auth, write staff
--   - game_saved_data: read/write own
--   - game_score: SELECT auth (leaderboards), INSERT own
--   - user_achievement: SELECT auth, INSERT via trigger (cuando lo escribas)
--
-- plant, garden_bed, garden_work, crop_diary:
--   - SELECT auth
--   - INSERT/UPDATE: garden_manager o staff (necesitarías helper is_garden_manager())
-- =====================================================================

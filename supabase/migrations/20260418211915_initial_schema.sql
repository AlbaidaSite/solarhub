-- =====================================================================
-- SOLARHUB - INITIAL SCHEMA
-- =====================================================================

-- =====================================================================
-- 1. ENUMS
-- =====================================================================
CREATE TYPE garden_work_type AS ENUM (
  'SIEMBRA', 'PREPARACION', 'RECOGIDA', 'PLANIFICACION'
);

CREATE TYPE attending_status AS ENUM (
  'GOING', 'INTERESTED', 'NOT_GOING'
);

CREATE TYPE media_type AS ENUM (
  'PHOTO', 'VIDEO'
);

-- =====================================================================
-- 2. FUNCIÓN REUTILIZABLE PARA updated_at
-- =====================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 3. USUARIOS
-- =====================================================================
CREATE TABLE profile (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  name text NOT NULL,
  profile_img text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_profile_updated
  BEFORE UPDATE ON profile
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE credentials (
  user_id uuid PRIMARY KEY REFERENCES profile(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  is_staff boolean NOT NULL DEFAULT false,
  is_superuser boolean NOT NULL DEFAULT false,
  is_loukou boolean NOT NULL DEFAULT false,
  is_garden_manager boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_credentials_updated
  BEFORE UPDATE ON credentials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE request (
  id smallserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  message text,
  is_approved boolean,
  request_date timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 4. CATÁLOGOS (sin dependencias)
-- =====================================================================
CREATE TABLE rarity (
  id smallserial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  icon_path text NOT NULL
);

CREATE TABLE category (
  id smallserial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  icon_path text NOT NULL,
  order_number smallint NOT NULL
);

CREATE TABLE sticker (
  id smallserial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  icon_path text NOT NULL
);

CREATE TABLE event_type (
  id smallserial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  icon_path text NOT NULL,
  color CHAR(7) NOT NULL,
  CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE TABLE game (
  id smallserial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  icon_path text NOT NULL
);

CREATE TABLE plant (
  id smallserial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  icon_path text NOT NULL,
  seed_info text,
  harvest_info text,
  months_of_growth text[],
  months_of_harvest text[]
);

CREATE TABLE artist (
  id smallserial PRIMARY KEY,
  name text NOT NULL,
  url text
);

CREATE TABLE achievement (
  id smallserial PRIMARY KEY,
  name text NOT NULL,
  icon_path text NOT NULL,
  description text,
  is_secret boolean NOT NULL DEFAULT false
);

CREATE TABLE country (
  code char(2) PRIMARY KEY,  -- ISO 3166-1 alpha-2: 'ES', 'FR', 'JP'
  name text NOT NULL
);


-- =====================================================================
-- 5. CROMOS
-- =====================================================================
CREATE TABLE cromo_labels (
  id smallserial PRIMARY KEY,
  has_owners boolean NOT NULL DEFAULT false,
  hide_til_registered boolean NOT NULL DEFAULT false,
  for_loukou boolean NOT NULL DEFAULT false,
  allow_multiple_users boolean NOT NULL DEFAULT false
);

CREATE TABLE cromo (
  id smallserial PRIMARY KEY,
  category_id smallint NOT NULL REFERENCES category(id),
  rarity_id smallint NOT NULL REFERENCES rarity(id),
  labels_id smallint NOT NULL REFERENCES cromo_labels(id),
  name text NOT NULL,
  front_img text NOT NULL,
  back_img text NOT NULL,
  description text,
  number smallint NOT NULL,
  variant smallint NOT NULL DEFAULT 0,
  copies smallint NOT NULL,
  how_to text,
  how_to_extended text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, number, variant)
);

CREATE TRIGGER trg_cromo_updated
  BEFORE UPDATE ON cromo
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE cromo_artist (
  cromo_id smallint NOT NULL REFERENCES cromo(id) ON DELETE CASCADE,
  artist_id smallint NOT NULL REFERENCES artist(id) ON DELETE CASCADE,
  PRIMARY KEY (cromo_id, artist_id)
);

CREATE TABLE unique_cromo (
  id serial PRIMARY KEY,
  cromo_id smallint NOT NULL REFERENCES cromo(id),
  code smallint NOT NULL,
  copy_number smallint NOT NULL,
  UNIQUE (cromo_id, code),
  UNIQUE (cromo_id, copy_number)
);

CREATE TABLE unique_reserved_code (
  id smallserial PRIMARY KEY,
  code smallint NOT NULL UNIQUE
);

CREATE TABLE unique_ownership (
  id serial PRIMARY KEY,
  unique_id int NOT NULL REFERENCES unique_cromo(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profile(id),
  date_acquired timestamptz NOT NULL DEFAULT now(),
  last_acquisition timestamptz NOT NULL DEFAULT now(),
  is_current_owner boolean NOT NULL DEFAULT true
);

-- Solo un current owner por unique si NO permite múltiples usuarios
CREATE OR REPLACE FUNCTION validate_single_current_owner()
RETURNS TRIGGER AS $$
DECLARE
  v_allow_multiple boolean;
  v_existing_owners int;
BEGIN
  -- Solo validamos si is_current_owner = true
  IF NEW.is_current_owner = false THEN
    RETURN NEW;
  END IF;

  -- Verificar si el cromo permite múltiples usuarios
  SELECT l.allow_multiple_users INTO v_allow_multiple
  FROM unique_cromo uc
  JOIN cromo c ON c.id = uc.cromo_id
  JOIN cromo_labels l ON l.id = c.labels_id
  WHERE uc.id = NEW.unique_id;

  -- Si permite múltiples, no hay restricción
  IF v_allow_multiple = true THEN
    RETURN NEW;
  END IF;

  -- Si no permite múltiples, comprobar que no haya ya otro current owner
  SELECT COUNT(*) INTO v_existing_owners
  FROM unique_ownership
  WHERE unique_id = NEW.unique_id
    AND is_current_owner = true
    AND id <> COALESCE(NEW.id, -1);

  IF v_existing_owners > 0 THEN
    RAISE EXCEPTION 'Este unique ya tiene un dueño actual y no admite múltiples';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_single_current_owner
  BEFORE INSERT OR UPDATE ON unique_ownership
  FOR EACH ROW EXECUTE FUNCTION validate_single_current_owner();

-- =====================================================================
-- 6. TRADES
-- =====================================================================
CREATE TABLE trade (
  id smallserial PRIMARY KEY,
  initiator_id uuid NOT NULL REFERENCES profile(id),
  recipient_id uuid NOT NULL REFERENCES profile(id),
  is_mutual_agreement boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (initiator_id <> recipient_id)
);

CREATE TABLE trade_offer (
  id smallserial PRIMARY KEY,
  trade_id smallint NOT NULL REFERENCES trade(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profile(id),
  is_accepted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trade_id, user_id)
);

CREATE TRIGGER trg_trade_offer_updated
  BEFORE UPDATE ON trade_offer
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE trade_unique (
  trade_offer_id smallint NOT NULL REFERENCES trade_offer(id) ON DELETE CASCADE,
  unique_id int NOT NULL REFERENCES unique_cromo(id),
  PRIMARY KEY (trade_offer_id, unique_id)
);

-- Validar que el user_id del trade_offer sea participante del trade
CREATE OR REPLACE FUNCTION validate_trade_offer_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id NOT IN (
    SELECT initiator_id FROM trade WHERE id = NEW.trade_id
    UNION
    SELECT recipient_id FROM trade WHERE id = NEW.trade_id
  ) THEN
    RAISE EXCEPTION 'trade_offer.user_id debe ser initiator o recipient del trade';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_trade_offer_user
  BEFORE INSERT OR UPDATE ON trade_offer
  FOR EACH ROW EXECUTE FUNCTION validate_trade_offer_user();

-- Resetear aceptaciones si se modifica la lista de uniques
CREATE OR REPLACE FUNCTION reset_trade_acceptance()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reset_acceptance
  AFTER INSERT OR DELETE ON trade_unique
  FOR EACH ROW EXECUTE FUNCTION reset_trade_acceptance();


-- Un Unique no puede estar involucrado en dos trades activos
CREATE OR REPLACE FUNCTION validate_unique_not_in_active_trade()
RETURNS TRIGGER AS $$
DECLARE
  v_active_count int;
BEGIN
  SELECT COUNT(*) INTO v_active_count
  FROM trade_unique tu
  JOIN trade_offer tof ON tof.id = tu.trade_offer_id
  JOIN trade t ON t.id = tof.trade_id
  WHERE tu.unique_id = NEW.unique_id
    AND tu.trade_offer_id <> NEW.trade_offer_id
    AND t.is_mutual_agreement = false;  -- trade aún no cerrado

  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'Este unique ya está comprometido en otro intercambio activo';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_unique_not_in_active_trade
  BEFORE INSERT ON trade_unique
  FOR EACH ROW EXECUTE FUNCTION validate_unique_not_in_active_trade();
-- =====================================================================
-- 7. MAPA
-- =====================================================================
CREATE TABLE pin (
  id smallserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profile(id),
  sticker_id smallint NOT NULL REFERENCES sticker(id),
  country_code char(2) NOT NULL REFERENCES country(code),
  state text,
  place text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE map_media (
  id serial PRIMARY KEY,
  pin_id smallint NOT NULL REFERENCES pin(id) ON DELETE CASCADE,
  path text NOT NULL,
  type media_type NOT NULL
);


-- =====================================================================
-- 8. CALENDARIO
-- =====================================================================
CREATE TABLE event (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profile(id),
  event_type_id smallint NOT NULL REFERENCES event_type(id),
  title text NOT NULL,
  description text,
  event_date timestamptz NOT NULL,
  place text,
  url text,
  is_one_time boolean NOT NULL DEFAULT true,
  includes_cromo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE event_price (
    id serial PRIMARY KEY,
    event_id int NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    reason text,
    price numeric(10,2) NOT NULL
);

CREATE TABLE attending (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profile(id),
  event_id int NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  status attending_status NOT NULL,
  UNIQUE (user_id, event_id)
);

-- =====================================================================
-- 9. JUEGOS
-- =====================================================================
CREATE TABLE game_saved_data (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profile(id),
  game_id smallint NOT NULL REFERENCES game(id),
  saved_data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id)
);

CREATE TRIGGER trg_game_saved_data_updated
  BEFORE UPDATE ON game_saved_data
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE game_score (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  game_id smallint NOT NULL REFERENCES game(id),
  score int NOT NULL,
  metadata jsonb,  -- opcional: tiempo, nivel, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 10. HUERTO
-- =====================================================================
CREATE TABLE garden_bed (
  id smallserial PRIMARY KEY,
  name text NOT NULL,
  width smallint NOT NULL,
  height smallint NOT NULL,
  pos_x smallint NOT NULL,
  pos_y smallint NOT NULL
);

CREATE TABLE garden_work (
  id smallserial PRIMARY KEY,
  plant_id smallint REFERENCES plant(id),
  garden_bed_id smallint REFERENCES garden_bed(id),
  description text,
  planned_start timestamptz NOT NULL,
  planned_end timestamptz NOT NULL,
  type garden_work_type NOT NULL,
  CHECK (planned_end >= planned_start)
);

CREATE TABLE crop_diary (
  id smallserial PRIMARY KEY,
  plant_id smallint NOT NULL REFERENCES plant(id),
  sow_year smallint NOT NULL,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_crop_diary_updated
  BEFORE UPDATE ON crop_diary
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- 11. LOGROS
-- =====================================================================
CREATE TABLE game_achievement (
  id smallserial PRIMARY KEY,
  game_id smallint NOT NULL REFERENCES game(id),
  achievement_id smallint NOT NULL REFERENCES achievement(id),
  number smallint NOT NULL,
  UNIQUE (game_id, achievement_id),
  UNIQUE (game_id, number)
);

CREATE TABLE user_achievement (
  user_id uuid NOT NULL REFERENCES profile(id),
  achievement_id smallint NOT NULL REFERENCES achievement(id),
  obtained_on timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

-- =====================================================================
-- 12. ÍNDICES ÚTILES
-- =====================================================================
CREATE INDEX idx_cromo_category ON cromo(category_id);
CREATE INDEX idx_cromo_rarity ON cromo(rarity_id);
CREATE INDEX idx_unique_cromo ON unique_cromo(cromo_id);
CREATE INDEX idx_unique_ownership_user ON unique_ownership(user_id);
CREATE INDEX idx_unique_ownership_unique ON unique_ownership(unique_id);
CREATE INDEX idx_trade_initiator ON trade(initiator_id);
CREATE INDEX idx_trade_recipient ON trade(recipient_id);
CREATE INDEX idx_trade_offer_trade ON trade_offer(trade_id);
CREATE INDEX idx_pin_user ON pin(user_id);
CREATE INDEX idx_event_date ON event(event_date);
CREATE INDEX idx_event_user ON event(user_id);
CREATE INDEX idx_attending_event ON attending(event_id);
CREATE INDEX idx_garden_work_dates ON garden_work(planned_start, planned_end);
CREATE INDEX idx_game_score_leaderboard ON game_score(game_id, score DESC);
CREATE INDEX idx_game_score_user ON game_score(user_id);
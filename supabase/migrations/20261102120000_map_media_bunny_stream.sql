-- =====================================================================
-- MAPA: vídeos de pins alojados en Bunny Stream
-- =====================================================================
-- Los vídeos nuevos dejan de guardarse en Supabase Storage: el navegador
-- los sube directamente a Bunny Stream (TUS) y se reproducen con el
-- player de Bunny mediante URL firmada. Las fotos siguen en Storage.
--
-- Una fila de map_media puede ser, a partir de ahora:
--   · Foto en Storage            → path, sin columnas de vídeo.
--   · Vídeo legado en Storage    → path, sin columnas de vídeo (hasta que
--                                  scripts/bunny/migrate-videos.ts lo pase).
--   · Vídeo en Bunny             → bunny_video_id + video_status. Durante
--                                  la migración de datos conserva path.
--
-- Retrocompatible: el código anterior solo inserta filas de las dos
-- primeras formas, así que se puede aplicar antes de desplegar.
--
-- RLS no cambia: map_media_insert_pin_owner ya exige autor del pin o staff
-- (20260601120000_enable_rls_remaining_tables.sql), y no hay política de
-- UPDATE para authenticated. El estado del vídeo lo escribe el servidor
-- con service_role; el trigger de abajo impide que un usuario lo falsee
-- incluso si en el futuro se abre el UPDATE.
-- =====================================================================

-- 1. Estado de procesamiento de vídeos alojados en Bunny
DO $$ BEGIN
  CREATE TYPE public.video_status AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Columnas nuevas
ALTER TABLE public.map_media
  ADD COLUMN IF NOT EXISTS bunny_video_id uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS video_status public.video_status,
  ADD COLUMN IF NOT EXISTS duration_s int2,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- 3. path deja de ser obligatorio: los vídeos de Bunny no tienen fichero en Storage
ALTER TABLE public.map_media ALTER COLUMN path DROP NOT NULL;

-- 4. Coherencia entre tipo y origen
ALTER TABLE public.map_media DROP CONSTRAINT IF EXISTS map_media_source_chk;
ALTER TABLE public.map_media ADD CONSTRAINT map_media_source_chk CHECK (
  -- Foto en Supabase Storage
  (type = 'PHOTO' AND path IS NOT NULL AND bunny_video_id IS NULL
     AND video_status IS NULL AND duration_s IS NULL)
  -- Vídeo legado en Supabase Storage (hasta ejecutar la migración de datos)
  OR (type = 'VIDEO' AND path IS NOT NULL AND bunny_video_id IS NULL
     AND video_status IS NULL AND duration_s IS NULL)
  -- Vídeo en Bunny (path puede seguir relleno durante la migración de datos)
  OR (type = 'VIDEO' AND bunny_video_id IS NOT NULL AND video_status IS NOT NULL)
);

-- 5. Solo el servidor (service_role) controla el estado del vídeo
CREATE OR REPLACE FUNCTION public.map_media_guard_video_columns()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF tg_op = 'INSERT' THEN
    IF NEW.video_status IS NOT NULL AND NEW.video_status <> 'UPLOADING' THEN
      RAISE EXCEPTION 'video_status solo puede inicializarse como UPLOADING' USING errcode = '42501';
    END IF;
    IF NEW.duration_s IS NOT NULL THEN
      RAISE EXCEPTION 'duration_s solo lo establece el servidor' USING errcode = '42501';
    END IF;
  ELSIF NEW.bunny_video_id IS DISTINCT FROM OLD.bunny_video_id
     OR NEW.video_status IS DISTINCT FROM OLD.video_status
     OR NEW.duration_s IS DISTINCT FROM OLD.duration_s THEN
    RAISE EXCEPTION 'Las columnas de vídeo solo las modifica el servidor' USING errcode = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_map_media_guard_video_columns ON public.map_media;
CREATE TRIGGER trg_map_media_guard_video_columns
  BEFORE INSERT OR UPDATE ON public.map_media
  FOR EACH ROW EXECUTE FUNCTION public.map_media_guard_video_columns();

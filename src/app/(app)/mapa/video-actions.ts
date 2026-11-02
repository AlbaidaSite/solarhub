"use server";

// Server actions de los vídeos de pins alojados en Bunny Stream. Los bytes
// del vídeo nunca pasan por aquí: el navegador los sube directo a Bunny por
// TUS con la firma que devuelve createVideoUploadAction.
//
// Mismo contrato que actions.ts: si requireUserActionClient falla, se
// devuelve sin construir el cliente admin ni llamar a Bunny.

import { requireUserActionClient } from "@/lib/supabase/actionAuth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getBunnyConfig } from "@/lib/bunny/config";
import { createVideo, deleteVideo } from "@/lib/bunny/api";
import { createReconcileDeps, reconcileVideo } from "@/lib/bunny/reconcile";
import { buildEmbedUrl, signEmbedToken, signTusUpload } from "@/lib/bunny/signing";
import { EMBED_TOKEN_TTL_S, TUS_SIGNATURE_TTL_S } from "@/lib/bunny/constants";
import { validateVideoFile } from "@/lib/media/videoValidation";
import { videoDisplayState, type VideoDisplay } from "@/lib/media/videoDisplay";
import type { VideoStatus } from "@/types/map";
import { canEditPin } from "./lib/pinPermissions";

type Failure = { ok: false; error: string };

const UNAVAILABLE = "El servicio de vídeo no está disponible ahora mismo. Inténtalo más tarde.";

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function loadConfig() {
  try {
    return getBunnyConfig();
  } catch (err) {
    console.error("Bunny sin configurar:", err);
    return null;
  }
}

interface VideoRow {
  id: number;
  pin_id: number;
  bunny_video_id: string | null;
  video_status: VideoStatus | null;
  created_at: string;
}

const VIDEO_ROW_COLUMNS = "id, pin_id, bunny_video_id, video_status, created_at";

// ─── Alta de una subida ──────────────────────────────────────────────────────

export type CreateVideoUploadResult =
  | {
      ok: true;
      mediaId: number;
      videoId: string;
      libraryId: string;
      title: string;
      expires: number;
      signature: string;
    }
  | Failure;

export async function createVideoUploadAction(input: {
  pinId: number;
  sizeBytes: number;
  durationS: number | null;
  mimeType: string;
}): Promise<CreateVideoUploadResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const errors = validateVideoFile({
    type: input.mimeType,
    size: input.sizeBytes,
    durationS: input.durationS,
  });
  if (errors.length > 0) return { ok: false, error: errors.join("\n") };

  const allowed = await canEditPin(supabase, input.pinId, userId);
  if (!allowed) return { ok: false, error: "Pin no encontrado o sin permiso." };

  const cfg = loadConfig();
  if (!cfg) return { ok: false, error: UNAVAILABLE };

  const title = `pin-${input.pinId}-${Date.now()}`;
  let guid: string;
  try {
    ({ guid } = await createVideo(cfg, title));
  } catch (err) {
    console.error("createVideo:", err);
    return { ok: false, error: "No se ha podido preparar la subida del vídeo." };
  }

  // Con el cliente del usuario: RLS exige autor del pin o staff y el
  // trigger solo admite video_status = 'UPLOADING' en el alta.
  const { data: inserted, error: insertError } = await supabase
    .from("map_media")
    .insert({
      pin_id: input.pinId,
      type: "VIDEO",
      path: null,
      bunny_video_id: guid,
      video_status: "UPLOADING",
    })
    .select("id")
    .single<{ id: number }>();

  if (insertError || !inserted) {
    console.error("map_media insert (vídeo):", insertError);
    try {
      await deleteVideo(cfg, guid);
    } catch (err) {
      console.error(`No se ha podido compensar el vídeo ${guid} en Bunny:`, err);
    }
    return { ok: false, error: "No se ha podido registrar el vídeo." };
  }

  const expires = nowSeconds() + TUS_SIGNATURE_TTL_S;
  return {
    ok: true,
    mediaId: inserted.id,
    videoId: guid,
    libraryId: cfg.libraryId,
    title,
    expires,
    signature: signTusUpload({ libraryId: cfg.libraryId, apiKey: cfg.apiKey, expires, videoId: guid }),
  };
}

// ─── Cancelación de una subida fallida ───────────────────────────────────────

export async function abortVideoUploadAction(mediaId: number): Promise<{ ok: true } | Failure> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { data: row } = await supabase
    .from("map_media")
    .select(VIDEO_ROW_COLUMNS)
    .eq("id", mediaId)
    .maybeSingle<VideoRow>();

  // Solo subidas a medias: un vídeo que ya llegó a Bunny se borra desde la
  // edición del pin (deleteMapMediaAction), con su regla de mínimo.
  if (!row || row.video_status !== "UPLOADING" || !row.bunny_video_id) {
    return { ok: false, error: "No se puede cancelar esta subida." };
  }

  const allowed = await canEditPin(supabase, row.pin_id, userId);
  if (!allowed) return { ok: false, error: "No se puede cancelar esta subida." };

  const { error } = await supabase.from("map_media").delete().eq("id", mediaId);
  if (error) {
    console.error("map_media delete (abort):", error);
    return { ok: false, error: "No se ha podido cancelar la subida." };
  }

  const cfg = loadConfig();
  if (cfg) {
    try {
      await deleteVideo(cfg, row.bunny_video_id);
    } catch (err) {
      console.error(`No se ha podido borrar el vídeo ${row.bunny_video_id} de Bunny:`, err);
    }
  }
  return { ok: true };
}

// ─── Sincronización del estado (polling del cliente) ─────────────────────────

export async function syncVideoStatusAction(
  mediaId: number,
): Promise<{ ok: true; display: VideoDisplay } | Failure> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { data: row } = await supabase
    .from("map_media")
    .select(VIDEO_ROW_COLUMNS)
    .eq("id", mediaId)
    .maybeSingle<VideoRow>();
  if (!row || !row.bunny_video_id || !row.video_status) {
    return { ok: false, error: "Vídeo no encontrado." };
  }

  const canManage = await canEditPin(supabase, row.pin_id, userId);
  let status: VideoStatus = row.video_status;

  // Solo se consulta a Bunny mientras el estado no es terminal. Sin
  // webhook (local, previews) es lo que hace avanzar el vídeo.
  if (status === "UPLOADING" || status === "PROCESSING") {
    const cfg = loadConfig();
    if (cfg) {
      const real = createReconcileDeps(createSupabaseAdminClient(), cfg);
      let deleted = false;
      try {
        await reconcileVideo(
          {
            ...real,
            updateRow: async (id, patch) => {
              await real.updateRow(id, patch);
              status = patch.video_status;
            },
            deleteRow: async (id) => {
              await real.deleteRow(id);
              deleted = true;
            },
          },
          row.bunny_video_id,
        );
      } catch (err) {
        // Un fallo puntual de Bunny no corta el polling: se informa del
        // último estado conocido y el siguiente ciclo lo reintenta.
        console.error(`syncVideoStatus ${row.bunny_video_id}:`, err);
      }
      if (deleted) return { ok: true, display: "hidden" };
    }
  }

  return {
    ok: true,
    display: videoDisplayState(
      { video_status: status, created_at: row.created_at },
      { canManage, now: Date.now() },
    ),
  };
}

// ─── URL firmada del reproductor ─────────────────────────────────────────────

// Se pide al pulsar play, no al abrir el modal, para que el token no caduque
// con el modal abierto.
export async function getVideoEmbedUrlAction(
  mediaId: number,
): Promise<{ ok: true; url: string } | Failure> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  const { data: row } = await supabase
    .from("map_media")
    .select(VIDEO_ROW_COLUMNS)
    .eq("id", mediaId)
    .maybeSingle<VideoRow>();
  if (!row || !row.bunny_video_id) return { ok: false, error: "Vídeo no encontrado." };
  if (row.video_status !== "READY") {
    return { ok: false, error: "El vídeo todavía no está disponible." };
  }

  const cfg = loadConfig();
  if (!cfg) return { ok: false, error: UNAVAILABLE };

  const expires = nowSeconds() + EMBED_TOKEN_TTL_S;
  const token = signEmbedToken({ tokenKey: cfg.tokenKey, videoId: row.bunny_video_id, expires });
  return {
    ok: true,
    url: buildEmbedUrl({
      libraryId: cfg.libraryId,
      videoId: row.bunny_video_id,
      token,
      expires,
      params: { autoplay: true, preload: true, playsinline: true },
    }),
  };
}

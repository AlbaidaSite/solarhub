"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserActionClient } from "@/lib/supabase/actionAuth";
import { getStorageUrl, STORAGE_BUCKET } from "@/lib/supabase/storage";
import { getBunnyConfig } from "@/lib/bunny/config";
import { deleteVideo } from "@/lib/bunny/api";
import { buildThumbnailUrl } from "@/lib/bunny/signing";
import { mediaSource } from "@/lib/media/mediaSource";
import type { Pin, Sticker, PinDetail, MapMedia, MapMediaRow } from "@/types/map";
import { canEditPin } from "./lib/pinPermissions";

// Vista que queda desfasada al crear, editar o borrar un pin. La invalida
// la propia action: si lo hiciera el cliente con router.refresh() junto al
// router.push(), la navegación se cancelaría (ver CromoEditForm.tsx).
const MAP_PATH = "/mapa";

export interface Country {
  code: string;
  name: string;
}

export interface CreatePinData {
  sticker_id: number;
  country_code: string;
  state: string | null;
  place: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export interface UpdatePinData {
  sticker_id: number;
  country_code: string;
  state: string | null;
  place: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export type MapActionResult = { ok: true } | { ok: false; error: string };

// ─── Read-only queries (no Result shape: SSR-friendly) ───────────────────────

export async function getPinsAndStickersAction(): Promise<{
  pins: Pin[];
  stickers: Record<number, Sticker>;
}> {
  const supabase = await createSupabaseServerClient();

  const { data: pinsData, error: pinsError } = await supabase
    .from("pin")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Pin[]>();

  if (pinsError) {
    console.error("Error loading pins:", pinsError);
    return { pins: [], stickers: {} };
  }

  const pins = pinsData ?? [];
  const stickerIds = [...new Set(pins.map((p) => p.sticker_id))];

  const { data: stickersData, error: stickersError } = await supabase
    .from("sticker")
    .select("id, name, icon_path")
    .in("id", stickerIds)
    .returns<Array<{ id: number; name: string; icon_path: string }>>();

  if (stickersError) {
    console.error("Error loading stickers:", stickersError);
  }

  const stickers: Record<number, Sticker> = {};
  for (const row of stickersData ?? []) {
    stickers[row.id] = {
      id: row.id,
      name: row.name,
      icon_path: getStorageUrl(row.icon_path),
    };
  }

  return { pins, stickers };
}

export async function getPinDetailAction(pinId: number): Promise<PinDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data: pin, error: pinError } = await supabase
    .from("pin")
    .select("*")
    .eq("id", pinId)
    .maybeSingle<Pin>();

  if (pinError || !pin) return null;

  const [countryRes, profileRes, stickerRes, mediaRes] = await Promise.all([
    supabase
      .from("country")
      .select("name")
      .eq("code", pin.country_code)
      .maybeSingle<{ name: string }>(),
    supabase
      .from("profile")
      .select("username")
      .eq("id", pin.user_id)
      .maybeSingle<{ username: string }>(),
    supabase
      .from("sticker")
      .select("id, name, icon_path")
      .eq("id", pin.sticker_id)
      .maybeSingle<{ id: number; name: string; icon_path: string }>(),
    supabase
      .from("map_media")
      .select("id, pin_id, path, type, bunny_video_id, video_status, created_at")
      .eq("pin_id", pinId)
      .returns<MapMediaRow[]>(),
  ]);

  const sticker: Sticker | null = stickerRes.data
    ? {
        id: stickerRes.data.id,
        name: stickerRes.data.name,
        icon_path: getStorageUrl(stickerRes.data.icon_path),
      }
    : null;

  const media: MapMedia[] = (mediaRes.data ?? []).flatMap((row) => {
    const item = toMapMedia(row);
    return item ? [item] : [];
  });

  // Ordenar: primero PHOTO, luego VIDEO
  media.sort((a, b) => {
    if (a.type === b.type) return a.id - b.id;
    return a.type === "PHOTO" ? -1 : 1;
  });

  return {
    pin,
    countryName: countryRes.data?.name ?? pin.country_code,
    username: profileRes.data?.username ?? "—",
    sticker,
    media,
  };
}

function toMapMedia(row: MapMediaRow): MapMedia | null {
  let source;
  try {
    source = mediaSource(row);
  } catch (err) {
    // El CHECK de la tabla lo impide; si aun así llega, se omite la fila
    // en vez de tumbar el detalle del pin entero.
    console.error(`map_media ${row.id}:`, err);
    return null;
  }

  if (source === "bunny-video") {
    const cdnHostname = process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME;
    return {
      id: row.id,
      pin_id: row.pin_id,
      source,
      type: "VIDEO",
      videoId: row.bunny_video_id!,
      videoStatus: row.video_status!,
      createdAt: row.created_at,
      thumbnailUrl: cdnHostname ? buildThumbnailUrl(cdnHostname, row.bunny_video_id!) : null,
    };
  }
  if (source === "supabase-video-legacy") {
    return { id: row.id, pin_id: row.pin_id, source, type: "VIDEO", url: getStorageUrl(row.path!) };
  }
  return { id: row.id, pin_id: row.pin_id, source, type: "PHOTO", url: getStorageUrl(row.path!) };
}

// Borra en Bunny los vídeos de filas que ya se han borrado en BD. La BD es
// lo autoritativo: si Bunny falla, la action no falla; queda en el log y
// scripts/bunny/cleanup.ts recoge el vídeo huérfano.
async function deleteBunnyVideosBestEffort(guids: string[]): Promise<void> {
  if (guids.length === 0) return;
  let cfg;
  try {
    cfg = getBunnyConfig();
  } catch (err) {
    console.error("Bunny sin configurar; vídeos pendientes de limpieza:", guids, err);
    return;
  }
  for (const guid of guids) {
    try {
      await deleteVideo(cfg, guid);
    } catch (err) {
      console.error(`No se ha podido borrar el vídeo ${guid} de Bunny:`, err);
    }
  }
}

export async function getUsernamesAction(
  userIds: string[]
): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profile")
    .select("id, username")
    .in("id", userIds)
    .returns<Array<{ id: string; username: string }>>();
  const result: Record<string, string> = {};
  for (const row of data ?? []) result[row.id] = row.username;
  return result;
}

export async function getStickersAction(): Promise<Sticker[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sticker")
    .select("id, name, icon_path")
    .order("name")
    .returns<Array<{ id: number; name: string; icon_path: string }>>();
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    icon_path: getStorageUrl(row.icon_path),
  }));
}

export async function getCountriesAction(): Promise<Country[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("country")
    .select("code, name")
    .order("name")
    .returns<Country[]>();
  if (error || !data) return [];
  return data;
}

// ─── Validación compartida create/update ─────────────────────────────────────

function validatePinPayload(data: CreatePinData | UpdatePinData): string | null {
  const errors: string[] = [];
  if (!data.sticker_id || !data.country_code || !data.place.trim()) {
    errors.push("Faltan campos obligatorios.");
  }
  if (data.latitude < -90 || data.latitude > 90) {
    errors.push("Latitud fuera de rango [-90, 90].");
  }
  if (data.longitude < -180 || data.longitude > 180) {
    errors.push("Longitud fuera de rango [-180, 180].");
  }
  return errors.length > 0 ? errors.join("\n") : null;
}

// ─── Auth: ¿puede el usuario actual editar/borrar este pin? ─────────────────
// La regla (autor o staff) vive en lib/pinPermissions.ts.

export async function checkPinEditPermissionAction(pinId: number): Promise<boolean> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return false;
  return canEditPin(auth.supabase, pinId, auth.userId);
}

// ─── Mutaciones ──────────────────────────────────────────────────────────────

export type CreatePinResult = { ok: true; pinId: number } | { ok: false; error: string };

export async function createPinAction(data: CreatePinData): Promise<CreatePinResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const validationError = validatePinPayload(data);
  if (validationError) return { ok: false, error: validationError };

  const { data: inserted, error: insertError } = await supabase
    .from("pin")
    .insert({
      user_id: userId,
      sticker_id: data.sticker_id,
      country_code: data.country_code,
      state: data.state || null,
      place: data.place.trim(),
      latitude: data.latitude,
      longitude: data.longitude,
      created_at: data.created_at,
    })
    .select("id")
    .single<{ id: number }>();

  if (insertError || !inserted) {
    return { ok: false, error: insertError?.message ?? "Error al guardar" };
  }
  revalidatePath(MAP_PATH);
  return { ok: true, pinId: inserted.id };
}

export async function updatePinAction(
  pinId: number,
  data: UpdatePinData
): Promise<MapActionResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const allowed = await canEditPin(supabase, pinId, userId);
  if (!allowed) return { ok: false, error: "Sin permiso para editar este pin." };

  const validationError = validatePinPayload(data);
  if (validationError) return { ok: false, error: validationError };

  const { error } = await supabase
    .from("pin")
    .update({
      sticker_id: data.sticker_id,
      country_code: data.country_code,
      state: data.state || null,
      place: data.place.trim(),
      latitude: data.latitude,
      longitude: data.longitude,
      created_at: data.created_at,
    })
    .eq("id", pinId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(MAP_PATH);
  return { ok: true };
}

export async function deleteMapMediaAction(
  mediaId: number,
  pinId: number
): Promise<MapActionResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const allowed = await canEditPin(supabase, pinId, userId);
  if (!allowed) return { ok: false, error: "Sin permiso." };

  const { data: media } = await supabase
    .from("map_media")
    .select("path, bunny_video_id")
    .eq("id", mediaId)
    .eq("pin_id", pinId)
    .maybeSingle<{ path: string | null; bunny_video_id: string | null }>();

  if (!media) return { ok: false, error: "Media no encontrada." };

  // Un pin no puede quedarse sin multimedia (RN: el alta y la edición lo
  // exigen, ver NewPinForm.tsx/EditPinForm.tsx). El formulario ya desactiva
  // el botón cuando queda un solo archivo, pero la regla se sostiene aquí:
  // es el único punto por el que pasan tanto el dueño como el staff. Para
  // sustituir el último archivo hay que subir el nuevo y guardar primero.
  const { data: siblings } = await supabase
    .from("map_media")
    .select("id")
    .eq("pin_id", pinId)
    .returns<Array<{ id: number }>>();

  if ((siblings ?? []).length <= 1) {
    return {
      ok: false,
      error:
        "La pegatina debe conservar al menos un archivo multimedia. Sube otro antes de borrar este.",
    };
  }

  if (media.path) {
    await supabase.storage.from(STORAGE_BUCKET).remove([media.path]);
  }

  const { error } = await supabase.from("map_media").delete().eq("id", mediaId);
  if (error) return { ok: false, error: error.message };

  if (media.bunny_video_id) await deleteBunnyVideosBestEffort([media.bunny_video_id]);
  return { ok: true };
}

export async function deletePinAction(pinId: number): Promise<MapActionResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const allowed = await canEditPin(supabase, pinId, userId);
  if (!allowed) return { ok: false, error: "Sin permiso para eliminar este pin." };

  // Recolectamos las rutas de storage y los vídeos de Bunny antes de borrar
  // las filas.
  const { data: mediaRows } = await supabase
    .from("map_media")
    .select("path, bunny_video_id")
    .eq("pin_id", pinId)
    .returns<Array<{ path: string | null; bunny_video_id: string | null }>>();

  const storagePaths = (mediaRows ?? []).flatMap((m) => (m.path ? [m.path] : []));
  const bunnyGuids = (mediaRows ?? []).flatMap((m) => (m.bunny_video_id ? [m.bunny_video_id] : []));

  if (storagePaths.length > 0) {
    await supabase.storage.from(STORAGE_BUCKET).remove(storagePaths);
  }

  await supabase.from("map_media").delete().eq("pin_id", pinId);

  const { error } = await supabase.from("pin").delete().eq("id", pinId);
  if (error) return { ok: false, error: error.message };

  await deleteBunnyVideosBestEffort(bunnyGuids);

  revalidatePath(MAP_PATH);
  return { ok: true };
}

const MAX_MEDIA_SIZE_BYTES = 15 * 1024 * 1024;
// Solo fotos: los vídeos nuevos van directos del navegador a Bunny Stream y
// su fila la crea createVideoUploadAction (video-actions.ts). Rechazar VIDEO
// aquí cierra la vía antigua de un vídeo en Supabase Storage.
const ALLOWED_MEDIA_TYPES = new Set<MediaItemToInsert["type"]>(["PHOTO"]);

export interface MediaItemToInsert {
  path: string;
  type: "PHOTO" | "VIDEO";
  mimeType: string;
  size: number;
}

export async function addMapMediaAction(
  pinId: number,
  items: MediaItemToInsert[]
): Promise<MapActionResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const allowed = await canEditPin(supabase, pinId, userId);
  if (!allowed) return { ok: false, error: "Pin no encontrado o sin permiso." };

  const errors: string[] = [];

  for (const item of items) {
    if (!ALLOWED_MEDIA_TYPES.has(item.type)) {
      errors.push(`${item.path}: tipo no permitido (${item.type})`);
      continue;
    }
    if (!item.mimeType.startsWith("image/")) {
      errors.push(`${item.path}: MIME inválido para PHOTO`);
      continue;
    }
    if (item.size > MAX_MEDIA_SIZE_BYTES) {
      errors.push(`${item.path}: demasiado grande (máx. 15 MB)`);
      continue;
    }

    const { error } = await supabase.from("map_media").insert({
      pin_id: pinId,
      path: item.path,
      type: item.type,
    });
    if (error) errors.push(`${item.path}: ${error.message}`);
  }

  if (errors.length > 0) return { ok: false, error: errors.join("\n") };
  return { ok: true };
}

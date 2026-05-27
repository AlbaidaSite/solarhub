"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserActionClient } from "@/lib/supabase/actionAuth";
import { getStorageUrl, STORAGE_BUCKET } from "@/lib/supabase/storage";
import type { Pin, Sticker, PinDetail, MapMedia } from "@/types/map";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

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
      .select("id, pin_id, path, type")
      .eq("pin_id", pinId)
      .returns<Array<{ id: number; pin_id: number; path: string; type: "PHOTO" | "VIDEO" }>>(),
  ]);

  const sticker: Sticker | null = stickerRes.data
    ? {
        id: stickerRes.data.id,
        name: stickerRes.data.name,
        icon_path: getStorageUrl(stickerRes.data.icon_path),
      }
    : null;

  const media: MapMedia[] = (mediaRes.data ?? []).map((row) => ({
    id: row.id,
    pin_id: row.pin_id,
    url: getStorageUrl(row.path),
    type: row.type,
  }));

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

async function canEditPin(supabase: ServerClient, pinId: number, userId: string): Promise<boolean> {
  const { data: pin } = await supabase
    .from("pin")
    .select("user_id")
    .eq("id", pinId)
    .maybeSingle<{ user_id: string }>();

  if (!pin) return false;
  if (pin.user_id === userId) return true;

  // No es el dueño — usamos el RPC SECURITY DEFINER que bypasea RLS de credentials
  const { data: isStaff } = await supabase.rpc("is_staff");
  return Boolean(isStaff);
}

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
    .select("path")
    .eq("id", mediaId)
    .eq("pin_id", pinId)
    .maybeSingle<{ path: string }>();

  if (!media) return { ok: false, error: "Media no encontrada." };

  await supabase.storage.from(STORAGE_BUCKET).remove([media.path]);

  const { error } = await supabase.from("map_media").delete().eq("id", mediaId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deletePinAction(pinId: number): Promise<MapActionResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const allowed = await canEditPin(supabase, pinId, userId);
  if (!allowed) return { ok: false, error: "Sin permiso para eliminar este pin." };

  // Recolectamos todas las rutas de storage antes de borrar las filas.
  const { data: mediaRows } = await supabase
    .from("map_media")
    .select("path")
    .eq("pin_id", pinId)
    .returns<Array<{ path: string }>>();

  if (mediaRows && mediaRows.length > 0) {
    await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(mediaRows.map((m) => m.path));
  }

  await supabase.from("map_media").delete().eq("pin_id", pinId);

  const { error } = await supabase.from("pin").delete().eq("id", pinId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

const MAX_MEDIA_SIZE_BYTES = 15 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = new Set<MediaItemToInsert["type"]>(["PHOTO", "VIDEO"]);

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
    if (item.type === "PHOTO" && !item.mimeType.startsWith("image/")) {
      errors.push(`${item.path}: MIME inválido para PHOTO`);
      continue;
    }
    if (item.type === "VIDEO" && !item.mimeType.startsWith("video/")) {
      errors.push(`${item.path}: MIME inválido para VIDEO`);
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

"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStorageUrl } from "@/lib/supabase/storage";
import type { Pin, Sticker, PinDetail, MapMedia } from "@/types/map";

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

export async function getPinsAndStickersAction(): Promise<{
  pins: Pin[];
  stickers: Record<number, Sticker>;
}> {
  const supabase = await createSupabaseServerClient();

  // Cargar todos los pines
  const { data: pinsData, error: pinsError } = await supabase
    .from("pin")
    .select("*")
    .order("created_at", { ascending: false });

  if (pinsError) {
    console.error("Error loading pins:", pinsError);
    return { pins: [], stickers: {} };
  }

  const pins = (pinsData || []).map((row) => ({
    id: row.id as number,
    user_id: row.user_id as string,
    sticker_id: row.sticker_id as number,
    country_code: row.country_code as string,
    state: (row.state as string) || null,
    place: row.place as string,
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    created_at: row.created_at as string,
  })) as Pin[];

  // Obtener IDs únicos de stickers
  const stickerIds = [...new Set(pins.map((p) => p.sticker_id))];

  // Cargar stickers
  const { data: stickersData, error: stickersError } = await supabase
    .from("sticker")
    .select("id, name, icon_path")
    .in("id", stickerIds);

  if (stickersError) {
    console.error("Error loading stickers:", stickersError);
  }

  const stickers: Record<number, Sticker> = {};
  (stickersData || []).forEach((row) => {
    stickers[row.id as number] = {
      id: row.id as number,
      name: row.name as string,
      icon_path: getStorageUrl(row.icon_path as string),
    };
  });

  return { pins, stickers };
}

export async function getPinDetailAction(pinId: number): Promise<PinDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data: pinData, error: pinError } = await supabase
    .from("pin")
    .select("*")
    .eq("id", pinId)
    .maybeSingle();

  if (pinError || !pinData) return null;

  const pin: Pin = {
    id: pinData.id as number,
    user_id: pinData.user_id as string,
    sticker_id: pinData.sticker_id as number,
    country_code: pinData.country_code as string,
    state: (pinData.state as string) || null,
    place: pinData.place as string,
    latitude: pinData.latitude as number,
    longitude: pinData.longitude as number,
    created_at: pinData.created_at as string,
  };

  const [countryRes, profileRes, stickerRes, mediaRes] = await Promise.all([
    supabase.from("country").select("name").eq("code", pin.country_code).maybeSingle(),
    supabase.from("profile").select("username").eq("id", pin.user_id).maybeSingle(),
    supabase.from("sticker").select("id, name, icon_path").eq("id", pin.sticker_id).maybeSingle(),
    supabase.from("map_media").select("id, pin_id, path, type").eq("pin_id", pinId),
  ]);

  const sticker: Sticker | null = stickerRes.data
    ? {
        id: stickerRes.data.id as number,
        name: stickerRes.data.name as string,
        icon_path: getStorageUrl(stickerRes.data.icon_path as string),
      }
    : null;

  const media: MapMedia[] = (mediaRes.data || []).map((row) => ({
    id: row.id as number,
    pin_id: row.pin_id as number,
    url: getStorageUrl(row.path as string),
    type: row.type as "PHOTO" | "VIDEO",
  }));

  // Ordenar: primero PHOTO, luego VIDEO
  media.sort((a, b) => {
    if (a.type === b.type) return a.id - b.id;
    return a.type === "PHOTO" ? -1 : 1;
  });

  return {
    pin,
    countryName: (countryRes.data?.name as string) ?? pin.country_code,
    username: (profileRes.data?.username as string) ?? "—",
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
    .in("id", userIds);
  const result: Record<string, string> = {};
  (data || []).forEach((row) => {
    result[row.id as string] = row.username as string;
  });
  return result;
}

export async function getStickersAction(): Promise<Sticker[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sticker")
    .select("id, name, icon_path")
    .order("name");
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as number,
    name: row.name as string,
    icon_path: getStorageUrl(row.icon_path as string),
  }));
}

export async function getCountriesAction(): Promise<Country[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("country")
    .select("code, name")
    .order("name");
  if (error || !data) return [];
  return data.map((row) => ({
    code: row.code as string,
    name: row.name as string,
  }));
}

export async function createPinAction(
  data: CreatePinData
): Promise<{ ok: true; pinId: number } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  // Backend validation
  if (!data.sticker_id || !data.country_code || !data.place.trim()) {
    return { ok: false, error: "Faltan campos obligatorios" };
  }
  if (data.latitude < -90 || data.latitude > 90) {
    return { ok: false, error: "Latitud fuera de rango [-90, 90]" };
  }
  if (data.longitude < -180 || data.longitude > 180) {
    return { ok: false, error: "Longitud fuera de rango [-180, 180]" };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("pin")
    .insert({
      user_id: user.id,
      sticker_id: data.sticker_id,
      country_code: data.country_code,
      state: data.state || null,
      place: data.place.trim(),
      latitude: data.latitude,
      longitude: data.longitude,
      created_at: data.created_at,
    })
    .select("id")
    .single();

  if (insertError || !inserted) return { ok: false, error: insertError?.message ?? "Error al guardar" };
  return { ok: true, pinId: inserted.id as number };
}

// ---------------------------------------------------------------------------
// Internal: checks if the current user can edit/delete a given pin.
// Returns true if owner, staff, or superuser.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function canEditPin(supabase: any, pinId: number): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: pin } = await supabase
    .from("pin")
    .select("user_id")
    .eq("id", pinId)
    .maybeSingle();

  if (!pin) return false;
  if ((pin.user_id as string) === user.id) return true;

  // Not the owner — use the SECURITY DEFINER RPC to bypass credentials RLS
  const { data: isStaff } = await supabase.rpc("is_staff");
  return !!isStaff;
}

export async function checkPinEditPermissionAction(pinId: number): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  return canEditPin(supabase, pinId);
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

export async function updatePinAction(
  pinId: number,
  data: UpdatePinData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();

  const allowed = await canEditPin(supabase, pinId);
  if (!allowed) return { ok: false, error: "Sin permiso para editar este pin" };

  if (!data.sticker_id || !data.country_code || !data.place.trim()) {
    return { ok: false, error: "Faltan campos obligatorios" };
  }
  if (data.latitude < -90 || data.latitude > 90) {
    return { ok: false, error: "Latitud fuera de rango [-90, 90]" };
  }
  if (data.longitude < -180 || data.longitude > 180) {
    return { ok: false, error: "Longitud fuera de rango [-180, 180]" };
  }

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

const STORAGE_BUCKET_SERVER =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "solarhub-assets";

export async function deleteMapMediaAction(
  mediaId: number,
  pinId: number
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const allowed = await canEditPin(supabase, pinId);
  if (!allowed) return { ok: false, error: "Sin permiso" };

  const { data: media } = await supabase
    .from("map_media")
    .select("path")
    .eq("id", mediaId)
    .eq("pin_id", pinId)
    .maybeSingle();

  if (!media) return { ok: false, error: "Media no encontrada" };

  await supabase.storage
    .from(STORAGE_BUCKET_SERVER)
    .remove([media.path as string]);

  const { error } = await supabase.from("map_media").delete().eq("id", mediaId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deletePinAction(
  pinId: number
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const allowed = await canEditPin(supabase, pinId);
  if (!allowed) return { ok: false, error: "Sin permiso para eliminar este pin" };

  // Collect all storage paths before deleting
  const { data: mediaRows } = await supabase
    .from("map_media")
    .select("path")
    .eq("pin_id", pinId);

  if (mediaRows && mediaRows.length > 0) {
    const paths = mediaRows.map((m) => m.path as string);
    await supabase.storage.from(STORAGE_BUCKET_SERVER).remove(paths);
  }

  await supabase.from("map_media").delete().eq("pin_id", pinId);

  const { error } = await supabase.from("pin").delete().eq("id", pinId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

const MAX_MEDIA_SIZE_BYTES = 15 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = new Set(["PHOTO", "VIDEO"]);

export interface MediaItemToInsert {
  path: string;
  type: "PHOTO" | "VIDEO";
  mimeType: string;
  size: number;
}

export async function addMapMediaAction(
  pinId: number,
  items: MediaItemToInsert[]
): Promise<{ ok: boolean; errors: string[] }> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: ["No autenticado"] };

  // Verify permission (owner, staff, or superuser)
  const allowed = await canEditPin(supabase, pinId);
  if (!allowed) {
    return { ok: false, errors: ["Pin no encontrado o sin permiso"] };
  }

  const errors: string[] = [];

  for (const item of items) {
    // Backend type validation
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

  return { ok: errors.length === 0, errors };
}

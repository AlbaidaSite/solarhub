"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStorageUrl } from "@/lib/supabase/storage";
import type { Pin, Sticker, PinDetail, MapMedia } from "@/types/map";

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

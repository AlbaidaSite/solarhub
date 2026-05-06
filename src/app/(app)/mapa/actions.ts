"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStorageUrl } from "@/lib/supabase/storage";
import type { Pin, Sticker } from "@/types/map";

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

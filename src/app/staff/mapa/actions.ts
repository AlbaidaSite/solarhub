"use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";

export type StickerActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function getAuthClient() {
  const supabase = await createSupabaseServerClient();
  const { data: isStaff, error } = await supabase.rpc("is_staff");
  if (error || !isStaff) return null;
  return supabase;
}

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "solarhub-assets";

export async function createStickerAction(formData: FormData): Promise<StickerActionResult> {
  const supabase = await getAuthClient();
  if (!supabase) return { ok: false, error: "No autorizado." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "El nombre es obligatorio." };

  const icon = formData.get("icon") as File | null;
  if (!icon || icon.size === 0) return { ok: false, error: "La imagen es obligatoria." };
  if (!icon.type.startsWith("image/")) return { ok: false, error: "El archivo debe ser una imagen." };

  const ext = icon.name.split(".").pop()?.toLowerCase() ?? "webp";
  const iconPath = `stickers/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(iconPath, icon, { contentType: icon.type, upsert: false });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { error } = await supabase.from("sticker").insert({ name, icon_path: iconPath });
  if (error) {
    await createSupabaseAdminClient().storage.from(BUCKET).remove([iconPath]);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function updateStickerAction(id: number, formData: FormData): Promise<StickerActionResult> {
  const supabase = await getAuthClient();
  if (!supabase) return { ok: false, error: "No autorizado." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "El nombre es obligatorio." };

  const icon = formData.get("icon") as File | null;
  const hasNewIcon = !!icon && icon.size > 0;

  if (hasNewIcon) {
    if (!icon.type.startsWith("image/")) return { ok: false, error: "El archivo debe ser una imagen." };

    const { data: existing } = await supabase
      .from("sticker")
      .select("icon_path")
      .eq("id", id)
      .maybeSingle();
    const oldPath = existing?.icon_path as string | null;

    const ext = icon.name.split(".").pop()?.toLowerCase() ?? "webp";
    const newPath = `stickers/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(newPath, icon, { contentType: icon.type, upsert: false });
    if (uploadError) return { ok: false, error: uploadError.message };

    const { error } = await supabase
      .from("sticker")
      .update({ name, icon_path: newPath })
      .eq("id", id);
    if (error) {
      await createSupabaseAdminClient().storage.from(BUCKET).remove([newPath]);
      return { ok: false, error: error.message };
    }

    if (oldPath) await createSupabaseAdminClient().storage.from(BUCKET).remove([oldPath]);
  } else {
    const { error } = await supabase.from("sticker").update({ name }).eq("id", id);
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function deleteStickerAction(id: number): Promise<StickerActionResult> {
  const supabase = await getAuthClient();
  if (!supabase) return { ok: false, error: "No autorizado." };

  const { data: sticker } = await supabase
    .from("sticker")
    .select("icon_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("sticker").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (sticker?.icon_path) {
    await createSupabaseAdminClient().storage.from(BUCKET).remove([sticker.icon_path as string]);
  }

  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { requireStaffActionClient } from "../lib/actionAuth";
import { getFile, getString } from "../lib/formData";
import { safeRemoveFromBucket, STORAGE_BUCKET } from "../lib/cromoStorage";

export type StickerActionResult = { ok: true } | { ok: false; error: string };

const LIST_PATH = "/staff/mapa";

function buildStickerPath(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "webp";
  return `stickers/${crypto.randomUUID()}.${ext}`;
}

export async function createStickerAction(
  formData: FormData,
): Promise<StickerActionResult> {
  const auth = await requireStaffActionClient();
  if (!auth.ok) return auth;

  const errors: string[] = [];
  const name = getString(formData, "name");
  if (!name) errors.push("El nombre es obligatorio.");

  const icon = getFile(formData, "icon");
  if (!icon) {
    errors.push("La imagen es obligatoria.");
  } else if (!icon.type.startsWith("image/")) {
    errors.push("El archivo debe ser una imagen.");
  }

  if (errors.length > 0) {
    return { ok: false, error: errors.join("\n") };
  }

  const iconPath = buildStickerPath(icon!.name);
  const { error: uploadError } = await auth.supabase.storage
    .from(STORAGE_BUCKET)
    .upload(iconPath, icon!, { contentType: icon!.type, upsert: false });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { error } = await auth.supabase
    .from("sticker")
    .insert({ name, icon_path: iconPath });
  if (error) {
    await safeRemoveFromBucket([iconPath]);
    return { ok: false, error: error.message };
  }

  revalidatePath(LIST_PATH);
  return { ok: true };
}

export async function updateStickerAction(
  id: number,
  formData: FormData,
): Promise<StickerActionResult> {
  const auth = await requireStaffActionClient();
  if (!auth.ok) return auth;

  const name = getString(formData, "name");
  if (!name) return { ok: false, error: "El nombre es obligatorio." };

  const icon = getFile(formData, "icon");

  if (!icon) {
    const { error } = await auth.supabase
      .from("sticker")
      .update({ name })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/stickers/${id}`);
    return { ok: true };
  }

  if (!icon.type.startsWith("image/")) {
    return { ok: false, error: "El archivo debe ser una imagen." };
  }

  const { data: existing } = await auth.supabase
    .from("sticker")
    .select("icon_path")
    .eq("id", id)
    .maybeSingle<{ icon_path: string | null }>();
  const oldPath = existing?.icon_path ?? null;

  const newPath = buildStickerPath(icon.name);
  const { error: uploadError } = await auth.supabase.storage
    .from(STORAGE_BUCKET)
    .upload(newPath, icon, { contentType: icon.type, upsert: false });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { error } = await auth.supabase
    .from("sticker")
    .update({ name, icon_path: newPath })
    .eq("id", id);
  if (error) {
    await safeRemoveFromBucket([newPath]);
    return { ok: false, error: error.message };
  }

  if (oldPath) await safeRemoveFromBucket([oldPath]);

  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/stickers/${id}`);
  return { ok: true };
}

export async function deleteStickerAction(
  id: number,
): Promise<StickerActionResult> {
  const auth = await requireStaffActionClient();
  if (!auth.ok) return auth;

  const { data: sticker } = await auth.supabase
    .from("sticker")
    .select("icon_path")
    .eq("id", id)
    .maybeSingle<{ icon_path: string | null }>();

  const { error } = await auth.supabase.from("sticker").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (sticker?.icon_path) {
    await safeRemoveFromBucket([sticker.icon_path]);
  }

  revalidatePath(LIST_PATH);
  return { ok: true };
}

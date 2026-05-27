"use server";

import { revalidatePath } from "next/cache";
import { requireStaffActionClient } from "../../lib/actionAuth";
import { getOptionalString, getString } from "../../lib/formData";

export type ArtistActionResult = { ok: true } | { ok: false; error: string };

const LIST_PATH = "/staff/cromos/artistas";

export async function createArtistAction(
  formData: FormData,
): Promise<ArtistActionResult> {
  const auth = await requireStaffActionClient();
  if (!auth.ok) return auth;

  const name = getString(formData, "name");
  if (!name) return { ok: false, error: "El nombre es obligatorio." };
  const url = getOptionalString(formData, "url");

  const { error } = await auth.supabase.from("artist").insert({ name, url });
  if (error) return { ok: false, error: error.message };

  revalidatePath(LIST_PATH);
  return { ok: true };
}

export async function updateArtistAction(
  id: number,
  formData: FormData,
): Promise<ArtistActionResult> {
  const auth = await requireStaffActionClient();
  if (!auth.ok) return auth;

  const name = getString(formData, "name");
  if (!name) return { ok: false, error: "El nombre es obligatorio." };
  const url = getOptionalString(formData, "url");

  const { error } = await auth.supabase
    .from("artist")
    .update({ name, url })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
  return { ok: true };
}

export async function deleteArtistAction(
  id: number,
): Promise<ArtistActionResult> {
  const auth = await requireStaffActionClient();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.from("artist").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(LIST_PATH);
  return { ok: true };
}

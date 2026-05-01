"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ArtistActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function getAuthClient() {
  const supabase = await createSupabaseServerClient();
  const { data: isStaff, error } = await supabase.rpc("is_staff");
  if (error || !isStaff) return null;
  return supabase;
}

export async function createArtistAction(
  formData: FormData,
): Promise<ArtistActionResult> {
  const supabase = await getAuthClient();
  if (!supabase) return { ok: false, error: "No autorizado." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "El nombre es obligatorio." };
  const url = String(formData.get("url") ?? "").trim() || null;

  const { error } = await supabase.from("artist").insert({ name, url });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateArtistAction(
  id: number,
  formData: FormData,
): Promise<ArtistActionResult> {
  const supabase = await getAuthClient();
  if (!supabase) return { ok: false, error: "No autorizado." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "El nombre es obligatorio." };
  const url = String(formData.get("url") ?? "").trim() || null;

  const { error } = await supabase.from("artist").update({ name, url }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteArtistAction(
  id: number,
): Promise<ArtistActionResult> {
  const supabase = await getAuthClient();
  if (!supabase) return { ok: false, error: "No autorizado." };

  const { error } = await supabase.from("artist").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

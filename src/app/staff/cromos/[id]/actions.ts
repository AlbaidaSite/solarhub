"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugify } from "@/app/(app)/cromos/lib/slug";

const SMALLINT_MIN = -32768;
const SMALLINT_MAX = 32767;
const STORAGE_BUCKET = "solarhub-assets";

export type UpdateCromoResult =
  | { ok: true }
  | { ok: false; error: string };

function parseJsonArray(raw: unknown): number[] | null {
  try {
    const parsed = JSON.parse(String(raw ?? ""));
    return Array.isArray(parsed) && parsed.every(Number.isInteger) ? parsed : null;
  } catch {
    return null;
  }
}

export async function updateCromoAction(
  cromoId: number,
  labelsId: number,
  formData: FormData,
): Promise<UpdateCromoResult> {
  const supabase = await createSupabaseServerClient();

  const { data: isStaff, error: authError } = await supabase.rpc("is_staff");
  if (authError || !isStaff) return { ok: false, error: "No autorizado." };

  // ── Parseo de campos ─────────────────────────────────────────────────────
  const name          = String(formData.get("name") ?? "").trim();
  const description   = String(formData.get("description") ?? "").trim() || null;
  const numberRaw     = Number(formData.get("number"));
  const categoryId    = Number(formData.get("categoryId"));
  const rarityId      = Number(formData.get("rarityId"));
  const howTo         = String(formData.get("howTo") ?? "").trim() || null;
  const howToExtended = String(formData.get("howToExtended") ?? "").trim() || null;
  const copiesRaw     = Number(formData.get("copies"));
  const allowMultiple = formData.get("allowMultiple") === "true";
  const forLoukou     = formData.get("forLoukou") === "true";
  const currentFront  = String(formData.get("currentFrontPath") ?? "");
  const currentBack   = String(formData.get("currentBackPath") ?? "");

  if (!name) return { ok: false, error: "El nombre es obligatorio." };
  if (!Number.isInteger(numberRaw) || numberRaw <= 0)
    return { ok: false, error: "Número inválido." };
  if (!Number.isInteger(categoryId) || categoryId <= 0)
    return { ok: false, error: "Categoría inválida." };
  if (!Number.isInteger(rarityId) || rarityId <= 0)
    return { ok: false, error: "Rareza inválida." };
  if (!Number.isInteger(copiesRaw) || copiesRaw <= 0)
    return { ok: false, error: "Copias inválido." };

  const artistIds = parseJsonArray(formData.get("artistIds")) ?? [];

  const codesRaw = parseJsonArray(formData.get("codes"));
  if (!codesRaw || codesRaw.length !== copiesRaw)
    return { ok: false, error: "Los códigos no cuadran con el número de copias." };
  if (codesRaw.some((c) => c < SMALLINT_MIN || c > SMALLINT_MAX))
    return { ok: false, error: "Algún código está fuera del rango smallint." };

  // ── Gestión de imágenes (opcional: solo si se sube archivo nuevo) ─────────
  const frontFile = formData.get("frontImage");
  const backFile  = formData.get("backImage");

  let frontPath = currentFront;
  let backPath  = currentBack;

  if (frontFile instanceof File && frontFile.size > 0) {
    if (frontFile.type !== "image/webp")
      return { ok: false, error: "La imagen frontal debe ser .webp." };
    const base = `${slugify(name) || "cromo"}-${Date.now()}`;
    frontPath = `cromos/${base}.webp`;
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(frontPath, frontFile, { contentType: "image/webp", upsert: false });
    if (upErr) return { ok: false, error: `Error subiendo frente: ${upErr.message}` };
  }

  if (backFile instanceof File && backFile.size > 0) {
    if (backFile.type !== "image/webp")
      return { ok: false, error: "La imagen del dorso debe ser .webp." };
    const base = `${slugify(name) || "cromo"}-${Date.now()}-back`;
    backPath = `cromos/${base}.webp`;
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(backPath, backFile, { contentType: "image/webp", upsert: false });
    if (upErr) return { ok: false, error: `Error subiendo dorso: ${upErr.message}` };
  }

  // ── Actualizar cromo_labels ───────────────────────────────────────────────
  const { error: labelsErr } = await supabase
    .from("cromo_labels")
    .update({ allow_multiple_users: allowMultiple, for_loukou: forLoukou })
    .eq("id", labelsId);
  if (labelsErr) return { ok: false, error: `Error actualizando labels: ${labelsErr.message}` };

  // ── Actualizar cromo (el variant NO cambia: lo mantiene la DB) ───────────
  const { error: cromoErr } = await supabase
    .from("cromo")
    .update({
      category_id:    categoryId,
      rarity_id:      rarityId,
      name,
      front_img:      frontPath,
      back_img:       backPath,
      description,
      number:         numberRaw,
      copies:         copiesRaw,
      how_to:         howTo,
      how_to_extended: howToExtended,
    })
    .eq("id", cromoId);
  if (cromoErr) return { ok: false, error: `Error actualizando cromo: ${cromoErr.message}` };

  // ── Actualizar cromo_artist: borrar los viejos, insertar los nuevos ───────
  const { error: delArtErr } = await supabase
    .from("cromo_artist")
    .delete()
    .eq("cromo_id", cromoId);
  if (delArtErr) return { ok: false, error: `Error borrando artistas: ${delArtErr.message}` };

  if (artistIds.length > 0) {
    const { error: insArtErr } = await supabase
      .from("cromo_artist")
      .insert(artistIds.map((aid) => ({ cromo_id: cromoId, artist_id: aid })));
    if (insArtErr) return { ok: false, error: `Error vinculando artistas: ${insArtErr.message}` };
  }

  // ── Gestionar unique_cromo ────────────────────────────────────────────────
  // 1. Borrar los que superan el nuevo número de copias (ON DELETE CASCADE
  //    también borra sus unique_ownership).
  const { error: delExcessErr } = await supabase
    .from("unique_cromo")
    .delete()
    .eq("cromo_id", cromoId)
    .gt("copy_number", copiesRaw);
  if (delExcessErr)
    return { ok: false, error: `Error borrando excess uniques: ${delExcessErr.message}` };

  // 2. Upsert del listado final (insert nuevas copias + actualiza las existentes).
  //    Conflicto posible si el usuario intercambia códigos entre dos copias;
  //    en ese caso la DB devolverá error y el staff debe usar valores intermedios.
  const upsertRows = codesRaw.map((code, i) => ({
    cromo_id:    cromoId,
    code,
    copy_number: i + 1,
  }));
  const { error: upsertErr } = await supabase
    .from("unique_cromo")
    .upsert(upsertRows, { onConflict: "cromo_id,copy_number" });
  if (upsertErr) return { ok: false, error: `Error actualizando uniques: ${upsertErr.message}` };

  return { ok: true };
}

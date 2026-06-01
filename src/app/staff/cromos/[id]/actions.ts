"use server";

import { revalidatePath } from "next/cache";
import { requireStaffActionClient } from "../../lib/actionAuth";
import { getFile, getString } from "../../lib/formData";
import { parseCromoFields } from "../../lib/cromoSchema";
import {
  buildSingleCromoImagePath,
  uploadCromoWebp,
} from "../../lib/cromoStorage";
import { isRpcFailure, isRpcSuccessVoid } from "@/lib/supabase/rpcResult";

export type UpdateCromoResult = { ok: true } | { ok: false; error: string };

// Toda la cadena update labels → update cromo → reset cromo_artist →
// purge+upsert unique_cromo vive ahora dentro de la RPC `update_cromo_full`,
// que envuelve esos 6 ops en una sola transacción. La TS solo gestiona
// subida opcional de imágenes y resuelve las rutas finales que se mandan al
// SQL (las nuevas si se subieron, las actuales si no).
export async function updateCromoAction(
  cromoId: number,
  labelsId: number,
  formData: FormData,
): Promise<UpdateCromoResult> {
  const auth = await requireStaffActionClient();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  const parsed = parseCromoFields(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const fields = parsed.data;

  let frontPath = getString(formData, "currentFrontPath");
  let backPath = getString(formData, "currentBackPath");

  const frontFile = getFile(formData, "frontImage");
  const backFile = getFile(formData, "backImage");

  if (frontFile) {
    const newPath = buildSingleCromoImagePath(fields.name, "front");
    const up = await uploadCromoWebp(supabase, newPath, frontFile);
    if (!up.ok) return { ok: false, error: `Error subiendo frente: ${up.error}` };
    frontPath = newPath;
  }

  if (backFile) {
    const newPath = buildSingleCromoImagePath(fields.name, "back");
    const up = await uploadCromoWebp(supabase, newPath, backFile);
    if (!up.ok) return { ok: false, error: `Error subiendo dorso: ${up.error}` };
    backPath = newPath;
  }

  const { data, error } = await supabase.rpc("update_cromo_full", {
    p_cromo_id: cromoId,
    p_labels_id: labelsId,
    p_name: fields.name,
    p_description: fields.description,
    p_number: fields.number,
    p_variant: fields.variant,
    p_category_id: fields.categoryId,
    p_rarity_id: fields.rarityId,
    p_how_to: fields.howTo,
    p_how_to_extended: fields.howToExtended,
    p_copies: fields.copies,
    p_allow_multiple: fields.allowMultiple,
    p_for_loukou: fields.forLoukou,
    p_front_img: frontPath,
    p_back_img: backPath,
    p_artist_ids: fields.artistIds,
    p_codes: fields.codes,
  });

  if (error) return { ok: false, error: error.message };
  if (isRpcFailure(data)) return { ok: false, error: data.error };
  if (!isRpcSuccessVoid(data)) {
    return { ok: false, error: "Respuesta inesperada al actualizar cromo." };
  }

  revalidatePath("/staff/cromos");
  revalidatePath(`/staff/cromos/${cromoId}`);
  return { ok: true };
}

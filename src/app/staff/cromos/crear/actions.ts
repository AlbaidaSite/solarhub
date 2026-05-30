"use server";

import { revalidatePath } from "next/cache";
import { requireStaffActionClient } from "../../lib/actionAuth";
import { getFile } from "../../lib/formData";
import {
  CROMO_SMALLINT_MAX,
  CROMO_SMALLINT_MIN,
  CROMO_SMALLINT_RANGE,
  parseCromoFields,
} from "../../lib/cromoSchema";
import {
  buildCromoImagePaths,
  safeRemoveFromBucket,
  uploadCromoWebp,
} from "../../lib/cromoStorage";
import {
  isNumber,
  isRpcFailure,
  isRpcSuccessWith,
} from "@/lib/supabase/rpcResult";

// ─────────────────────────────────────────────────────────────────────────────
// generateCodesAction (sin cambios estructurales: pura lógica TS)
// ─────────────────────────────────────────────────────────────────────────────

export type GenerateCodesResult =
  | { ok: true; codes: number[] }
  | { ok: false; error: string };

export async function generateCodesAction(
  categoryId: number,
  copies: number,
): Promise<GenerateCodesResult> {
  const auth = await requireStaffActionClient();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  const errors: string[] = [];
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    errors.push("Categoría inválida.");
  }
  if (!Number.isInteger(copies) || copies <= 0) {
    errors.push("Copias debe ser un entero positivo.");
  } else if (copies > 1000) {
    errors.push("Máximo 1000 copias por cromo.");
  }
  if (errors.length > 0) return { ok: false, error: errors.join("\n") };

  const { data: existing, error: existErr } = await supabase
    .from("unique_cromo")
    .select("code, cromo:cromo_id!inner(category_id)")
    .eq("cromo.category_id", categoryId);
  if (existErr) return { ok: false, error: existErr.message };

  const { data: reserved, error: resErr } = await supabase
    .from("unique_reserved_code")
    .select("code");
  if (resErr) return { ok: false, error: resErr.message };

  const used = new Set<number>();
  for (const row of existing ?? []) {
    if (typeof row.code === "number") used.add(row.code);
  }
  for (const row of reserved ?? []) {
    if (typeof row.code === "number") used.add(row.code);
  }

  const free = CROMO_SMALLINT_RANGE - used.size;
  if (copies > free) {
    return {
      ok: false,
      error: `No hay suficientes codes libres en esta categoría (${free} disponibles).`,
    };
  }

  // Densidad alta → rejection-sampling es costoso; usamos Fisher-Yates parcial
  // sobre el conjunto libre cuando >50% del rango está ocupado.
  const codes =
    used.size > CROMO_SMALLINT_RANGE / 2
      ? pickFromFreePool(used, copies)
      : rejectionSample(used, copies);

  return { ok: true, codes };
}

function rejectionSample(used: Set<number>, copies: number): number[] {
  const codes: number[] = [];
  while (codes.length < copies) {
    const r = Math.floor(Math.random() * CROMO_SMALLINT_RANGE) + CROMO_SMALLINT_MIN;
    if (!used.has(r)) {
      used.add(r);
      codes.push(r);
    }
  }
  return codes;
}

function pickFromFreePool(used: Set<number>, copies: number): number[] {
  const pool: number[] = [];
  for (let i = CROMO_SMALLINT_MIN; i <= CROMO_SMALLINT_MAX; i++) {
    if (!used.has(i)) pool.push(i);
  }
  for (let i = 0; i < copies; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, copies);
}

// ─────────────────────────────────────────────────────────────────────────────
// createCromoAction — TS solo valida y sube imágenes; los 4 inserts viven
// dentro de la RPC `create_cromo_full` en una sola transacción.
// ─────────────────────────────────────────────────────────────────────────────

export type CreateCromoResult =
  | { ok: true; cromoId: number }
  | { ok: false; error: string };

export async function createCromoAction(
  formData: FormData,
): Promise<CreateCromoResult> {
  const auth = await requireStaffActionClient();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  // Unificamos validación de campos + validación de ficheros en una sola
  // lista de errores. Tras el guard, TS estrecha frontImage/backImage a
  // File (no-nullable) sin necesidad de assertions.
  const parsed = parseCromoFields(formData);
  const frontImage = getFile(formData, "frontImage");
  const backImage = getFile(formData, "backImage");

  const validationErrors: string[] = parsed.ok ? [] : [...parsed.errors];
  if (!frontImage) validationErrors.push("Falta la imagen frontal.");
  if (!backImage) validationErrors.push("Falta la imagen del dorso.");

  if (!parsed.ok || !frontImage || !backImage) {
    return { ok: false, error: validationErrors.join("\n") };
  }
  const fields = parsed.data;

  // Subida de imágenes a Storage. Si falla la segunda, limpiamos la primera.
  const paths = buildCromoImagePaths(fields.name);

  const upFront = await uploadCromoWebp(supabase, paths.front, frontImage);
  if (!upFront.ok) {
    return { ok: false, error: `Error subiendo frente: ${upFront.error}` };
  }

  const upBack = await uploadCromoWebp(supabase, paths.back, backImage);
  if (!upBack.ok) {
    await safeRemoveFromBucket([paths.front]);
    return { ok: false, error: `Error subiendo dorso: ${upBack.error}` };
  }

  // Single round-trip: todos los inserts en una transacción Postgres.
  const { data, error } = await supabase.rpc("create_cromo_full", {
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
    p_front_img: paths.front,
    p_back_img: paths.back,
    p_artist_ids: fields.artistIds,
    p_codes: fields.codes,
  });

  if (error) {
    await safeRemoveFromBucket([paths.front, paths.back]);
    return { ok: false, error: error.message };
  }

  if (isRpcFailure(data)) {
    await safeRemoveFromBucket([paths.front, paths.back]);
    return { ok: false, error: data.error };
  }

  if (!isRpcSuccessWith(data, "cromo_id", isNumber)) {
    await safeRemoveFromBucket([paths.front, paths.back]);
    return { ok: false, error: "Respuesta inesperada al crear cromo." };
  }

  revalidatePath("/staff/cromos");
  return { ok: true, cromoId: data.cromo_id };
}

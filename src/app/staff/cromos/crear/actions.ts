"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugify } from "@/app/(app)/cromos/lib/slug";

const SMALLINT_MIN = -32768;
const SMALLINT_MAX = 32767;
const SMALLINT_RANGE = SMALLINT_MAX - SMALLINT_MIN + 1; // 65536
const STORAGE_BUCKET = "solarhub-assets";

// ─────────────────────────────────────────────────────────────────────────────
// generateCodesAction
// ─────────────────────────────────────────────────────────────────────────────

export type GenerateCodesResult =
  | { ok: true; codes: number[] }
  | { ok: false; error: string };

export async function generateCodesAction(
  categoryId: number,
  copies: number,
): Promise<GenerateCodesResult> {
  const supabase = await createSupabaseServerClient();

  const { data: isStaff, error: authError } = await supabase.rpc("is_staff");
  if (authError || !isStaff) return { ok: false, error: "No autorizado." };

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { ok: false, error: "Categoría inválida." };
  }
  if (!Number.isInteger(copies) || copies <= 0) {
    return { ok: false, error: "Copias debe ser un entero positivo." };
  }
  if (copies > 1000) {
    return { ok: false, error: "Máximo 1000 copias por cromo." };
  }

  // Codes ya en uso para esta categoría (vía join con cromo)
  const { data: existing, error: existErr } = await supabase
    .from("unique_cromo")
    .select("code, cromo:cromo_id!inner(category_id)")
    .eq("cromo.category_id", categoryId);
  if (existErr) return { ok: false, error: existErr.message };

  // Codes reservados
  const { data: reserved, error: resErr } = await supabase
    .from("unique_reserved_code")
    .select("code");
  if (resErr) return { ok: false, error: resErr.message };

  const used = new Set<number>();
  for (const e of (existing ?? []) as unknown as Array<{ code: number }>) used.add(e.code);
  for (const r of reserved ?? []) used.add(r.code);

  const free = SMALLINT_RANGE - used.size;
  if (copies > free) {
    return {
      ok: false,
      error: `No hay suficientes codes libres en esta categoría (${free} disponibles).`,
    };
  }

  // Si la densidad es alta, el rejection-sampling se vuelve costoso; caemos
  // a Fisher-Yates parcial sobre el conjunto libre cuando >50% ocupado.
  const codes: number[] =
    used.size > SMALLINT_RANGE / 2
      ? pickFromFreePool(used, copies)
      : rejectionSample(used, copies);

  return { ok: true, codes };
}

function rejectionSample(used: Set<number>, copies: number): number[] {
  const codes: number[] = [];
  while (codes.length < copies) {
    const r = Math.floor(Math.random() * SMALLINT_RANGE) + SMALLINT_MIN;
    if (!used.has(r)) {
      used.add(r);
      codes.push(r);
    }
  }
  return codes;
}

function pickFromFreePool(used: Set<number>, copies: number): number[] {
  const pool: number[] = [];
  for (let i = SMALLINT_MIN; i <= SMALLINT_MAX; i++) {
    if (!used.has(i)) pool.push(i);
  }
  // Fisher-Yates parcial: solo barajamos los `copies` primeros
  for (let i = 0; i < copies; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, copies);
}

// ─────────────────────────────────────────────────────────────────────────────
// createCromoAction
// ─────────────────────────────────────────────────────────────────────────────

export type CreateCromoResult =
  | { ok: true; cromoId: number }
  | { ok: false; error: string };

function parseJsonArray(raw: unknown): number[] | null {
  try {
    const parsed = JSON.parse(String(raw ?? ""));
    if (!Array.isArray(parsed)) return null;
    if (!parsed.every((n) => Number.isInteger(n))) return null;
    return parsed as number[];
  } catch {
    return null;
  }
}

export async function createCromoAction(formData: FormData): Promise<CreateCromoResult> {
  const supabase = await createSupabaseServerClient();

  const { data: isStaff, error: authError } = await supabase.rpc("is_staff");
  if (authError || !isStaff) return { ok: false, error: "No autorizado." };

  // ── Parse y validación de campos ──────────────────────────────────────────
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const numberRaw = Number(formData.get("number"));
  const categoryId = Number(formData.get("categoryId"));
  const rarityId = Number(formData.get("rarityId"));
  const howTo = String(formData.get("howTo") ?? "").trim() || null;
  const howToExtended = String(formData.get("howToExtended") ?? "").trim() || null;
  const copiesRaw = Number(formData.get("copies"));
  const allowMultiple = formData.get("allowMultiple") === "true";
  const forLoukou = formData.get("forLoukou") === "true";

  if (!name) return { ok: false, error: "El nombre es obligatorio." };
  if (!Number.isInteger(numberRaw) || numberRaw <= 0)
    return { ok: false, error: "Número inválido." };
  if (!Number.isInteger(categoryId) || categoryId <= 0)
    return { ok: false, error: "Categoría inválida." };
  if (!Number.isInteger(rarityId) || rarityId <= 0)
    return { ok: false, error: "Rareza inválida." };
  if (!Number.isInteger(copiesRaw) || copiesRaw <= 0)
    return { ok: false, error: "Copias inválido." };

  const codes = parseJsonArray(formData.get("codes"));
  if (!codes || codes.length !== copiesRaw)
    return { ok: false, error: "Codes inválidos o desincronizados con copias." };
  if (codes.some((c) => c < SMALLINT_MIN || c > SMALLINT_MAX))
    return { ok: false, error: "Code fuera de rango smallint." };

  const artistIds = parseJsonArray(formData.get("artistIds")) ?? [];

  const frontImage = formData.get("frontImage");
  const backImage = formData.get("backImage");
  if (!(frontImage instanceof File) || frontImage.size === 0)
    return { ok: false, error: "Falta la imagen frontal." };
  if (!(backImage instanceof File) || backImage.size === 0)
    return { ok: false, error: "Falta la imagen del dorso." };
  if (frontImage.type !== "image/webp")
    return { ok: false, error: "La imagen frontal debe ser .webp." };
  if (backImage.type !== "image/webp")
    return { ok: false, error: "La imagen del dorso debe ser .webp." };

  const variantRaw = Number(formData.get("variant"));
  if (!Number.isInteger(variantRaw) || variantRaw < 0)
    return { ok: false, error: "Variante inválida." };

  // ── Verificar que ningún code ya existe en esta categoría ────────────────
  const { data: conflicting, error: conflictErr } = await supabase
    .from("unique_cromo")
    .select("code, cromo:cromo_id!inner(category_id)")
    .eq("cromo.category_id", categoryId)
    .in("code", codes);
  if (conflictErr) return { ok: false, error: conflictErr.message };
  if (conflicting && conflicting.length > 0) {
    const dupes = (conflicting as unknown as Array<{ code: number }>)
      .map((r) => r.code)
      .join(", ");
    return { ok: false, error: `Los siguientes codes ya existen en esta categoría: ${dupes}` };
  }

  // ── Subir imágenes a storage ──────────────────────────────────────────────
  const baseName = `${slugify(name) || "cromo"}-${Date.now()}`;
  const frontPath = `cromos/${baseName}.webp`;
  const backPath = `cromos/${baseName}-back.webp`;

  const cleanupStorage = async () => {
    await supabase.storage.from(STORAGE_BUCKET).remove([frontPath, backPath]).catch(() => {});
  };

  const { error: upFrontErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(frontPath, frontImage, { contentType: "image/webp", upsert: false });
  if (upFrontErr) return { ok: false, error: `Error subiendo frente: ${upFrontErr.message}` };

  const { error: upBackErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(backPath, backImage, { contentType: "image/webp", upsert: false });
  if (upBackErr) {
    await cleanupStorage();
    return { ok: false, error: `Error subiendo dorso: ${upBackErr.message}` };
  }

  // ── Insertar cromo_labels ────────────────────────────────────────────────
  const { data: labelRow, error: labelErr } = await supabase
    .from("cromo_labels")
    .insert({
      has_owners: false,
      hide_til_registered: false,
      for_loukou: forLoukou,
      allow_multiple_users: allowMultiple,
    })
    .select("id")
    .single();
  if (labelErr || !labelRow) {
    await cleanupStorage();
    return { ok: false, error: `Error creando labels: ${labelErr?.message ?? "desconocido"}` };
  }

  // ── Insertar cromo ───────────────────────────────────────────────────────
  const { data: cromoRow, error: cromoErr } = await supabase
    .from("cromo")
    .insert({
      category_id: categoryId,
      rarity_id: rarityId,
      labels_id: labelRow.id,
      name,
      front_img: frontPath,
      back_img: backPath,
      description,
      number: numberRaw,
      variant: variantRaw,
      copies: copiesRaw,
      how_to: howTo,
      how_to_extended: howToExtended,
    })
    .select("id")
    .single();
  if (cromoErr || !cromoRow) {
    await supabase.from("cromo_labels").delete().eq("id", labelRow.id);
    await cleanupStorage();
    const msg = cromoErr?.message ?? "";
    if (msg.includes("cromo_category_id_number_variant_key"))
      return { ok: false, error: "Ya existe un cromo con este número en esta categoría. ¿Es esto una variante?" };
    return { ok: false, error: `Error creando cromo: ${msg || "desconocido"}` };
  }

  const cromoId = cromoRow.id as number;

  // ── Insertar cromo_artist (si hay artistas) ──────────────────────────────
  if (artistIds.length > 0) {
    const { error: caErr } = await supabase
      .from("cromo_artist")
      .insert(artistIds.map((aid) => ({ cromo_id: cromoId, artist_id: aid })));
    if (caErr) {
      await supabase.from("cromo").delete().eq("id", cromoId);
      await supabase.from("cromo_labels").delete().eq("id", labelRow.id);
      await cleanupStorage();
      return { ok: false, error: `Error vinculando artistas: ${caErr.message}` };
    }
  }

  // ── Insertar unique_cromo (uno por code/copy) ────────────────────────────
  const uniqueRows = codes.map((code, idx) => ({
    cromo_id: cromoId,
    code,
    copy_number: idx + 1,
  }));
  const { error: uniqueErr } = await supabase.from("unique_cromo").insert(uniqueRows);
  if (uniqueErr) {
    // cromo_artist se borra en cascada al borrar cromo (FK ON DELETE CASCADE)
    await supabase.from("cromo").delete().eq("id", cromoId);
    await supabase.from("cromo_labels").delete().eq("id", labelRow.id);
    await cleanupStorage();
    return { ok: false, error: `Error creando uniques: ${uniqueErr.message}` };
  }

  return { ok: true, cromoId };
}

"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildIdSlug } from "../lib/slug";

export type RegisterCromoResult =
  | { ok: true; idSlug: string }
  | {
      ok: false;
      reason: "unauthorized" | "not_found" | "unknown";
      message: string;
    };

// unique_cromo.code se almacena como smallint (16 bits con signo) en Postgres.
const SMALLINT_MIN = -32768;
const SMALLINT_MAX = 32767;

export async function registerCromoAction(
  categoryId: number,
  code: number,
): Promise<RegisterCromoResult> {
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { ok: false, reason: "unknown", message: "Categoría inválida." };
  }
  if (!Number.isInteger(code) || code < SMALLINT_MIN || code > SMALLINT_MAX) {
    return {
      ok: false,
      reason: "not_found",
      message: "No existe ningún cromo con esa combinación.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, reason: "unauthorized", message: "Sesión expirada." };
  }

  const { data: unique, error: findError } = await supabase
    .from("unique_cromo")
    .select("id, cromo:cromo_id!inner(id, name, category_id)")
    .eq("code", code)
    .eq("cromo.category_id", categoryId)
    .limit(1)
    .maybeSingle();

  if (findError) {
    return { ok: false, reason: "unknown", message: findError.message };
  }
  if (!unique) {
    return {
      ok: false,
      reason: "not_found",
      message: "No existe ningún cromo con esa combinación.",
    };
  }

  const uniqueRow = unique as unknown as {
    id: number;
    cromo: { id: number; name: string; category_id: number } | null;
  };
  const uniqueId = uniqueRow.id;
  const cromo = uniqueRow.cromo;
  if (!uniqueId || !cromo?.id) {
    return {
      ok: false,
      reason: "unknown",
      message: "Datos del cromo incompletos.",
    };
  }

  const idSlug = buildIdSlug(cromo.id, cromo.name);

  // Si el usuario ya es current owner de este unique, no duplicamos la fila.
  const { data: existing, error: existsError } = await supabase
    .from("unique_ownership")
    .select("id")
    .eq("unique_id", uniqueId)
    .eq("user_id", user.id)
    .eq("is_current_owner", true)
    .limit(1)
    .maybeSingle();
  if (existsError) {
    return { ok: false, reason: "unknown", message: existsError.message };
  }
  if (existing) {
    return { ok: true, idSlug };
  }

  const { error: insertError } = await supabase
    .from("unique_ownership")
    .insert({
      unique_id: uniqueId,
      user_id: user.id,
      is_current_owner: true,
    });
  if (insertError) {
    return { ok: false, reason: "unknown", message: insertError.message };
  }

  return { ok: true, idSlug };
}

"use server";

import { requireUserActionClient } from "@/lib/supabase/actionAuth";
import { buildIdSlug } from "../lib/slug";

export type RegisterCromoResult =
  | { ok: true; idSlug: string; uniqueId: number }
  | { ok: false; error: string };

// unique_cromo.code se almacena como smallint (16 bits con signo) en Postgres.
const SMALLINT_MIN = -32768;
const SMALLINT_MAX = 32767;

const NOT_FOUND_MSG = "No existe ningún cromo con esa combinación.";

type UniqueLookupRow = {
  id: number;
  cromo: { id: number; name: string; category_id: number } | null;
};

export async function registerCromoAction(
  categoryId: number,
  code: number,
): Promise<RegisterCromoResult> {
  const errors: string[] = [];
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    errors.push("Categoría inválida.");
  }
  if (!Number.isInteger(code) || code < SMALLINT_MIN || code > SMALLINT_MAX) {
    errors.push(NOT_FOUND_MSG);
  }
  if (errors.length > 0) return { ok: false, error: errors.join("\n") };

  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { data: unique, error: findError } = await supabase
    .from("unique_cromo")
    .select("id, cromo:cromo_id!inner(id, name, category_id)")
    .eq("code", code)
    .eq("cromo.category_id", categoryId)
    .limit(1)
    .maybeSingle<UniqueLookupRow>();

  if (findError) return { ok: false, error: findError.message };
  if (!unique) return { ok: false, error: NOT_FOUND_MSG };

  const cromo = unique.cromo;
  if (!cromo?.id) return { ok: false, error: "Datos del cromo incompletos." };

  const idSlug = buildIdSlug(cromo.id, cromo.name);

  // Si el usuario ya es current owner de este unique, no duplicamos la fila.
  const { data: existing, error: existsError } = await supabase
    .from("unique_ownership")
    .select("id")
    .eq("unique_id", unique.id)
    .eq("user_id", userId)
    .eq("is_current_owner", true)
    .limit(1)
    .maybeSingle();
  if (existsError) return { ok: false, error: existsError.message };
  if (existing) return { ok: true, idSlug, uniqueId: unique.id };

  const { error: insertError } = await supabase
    .from("unique_ownership")
    .insert({
      unique_id: unique.id,
      user_id: userId,
      is_current_owner: true,
    });
  if (insertError) return { ok: false, error: insertError.message };

  return { ok: true, idSlug, uniqueId: unique.id };
}

"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DeleteCromoResult =
  | { ok: true }
  | { ok: false; error: string };

export async function deleteCromoAction(id: number): Promise<DeleteCromoResult> {
  const supabase = await createSupabaseServerClient();

  const { data: isStaff, error: authError } = await supabase.rpc("is_staff");
  if (authError || !isStaff) {
    return { ok: false, error: "No autorizado." };
  }

  const { error } = await supabase.from("cromo").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

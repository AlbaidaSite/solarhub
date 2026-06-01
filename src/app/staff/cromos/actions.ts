"use server";

import { revalidatePath } from "next/cache";
import { requireStaffActionClient } from "../lib/actionAuth";

export type DeleteCromoResult = { ok: true } | { ok: false; error: string };

export async function deleteCromoAction(id: number): Promise<DeleteCromoResult> {
  const auth = await requireStaffActionClient();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.from("cromo").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/staff/cromos");
  return { ok: true };
}

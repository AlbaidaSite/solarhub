"use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";

export type RequestActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function getAuthClient() {
  const supabase = await createSupabaseServerClient();
  const { data: isStaff, error } = await supabase.rpc("is_staff");
  if (error || !isStaff) return null;
  return supabase;
}

export async function approveRequestAction(requestId: number): Promise<RequestActionResult> {
  const supabase = await getAuthClient();
  if (!supabase) return { ok: false, error: "No autorizado." };

  const { error } = await supabase
    .from("request")
    .update({ is_approved: true })
    .eq("id", requestId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function denyRequestAction(requestId: number): Promise<RequestActionResult> {
  const supabase = await getAuthClient();
  if (!supabase) return { ok: false, error: "No autorizado." };

  const { error } = await supabase
    .from("request")
    .update({ is_approved: false })
    .eq("id", requestId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface CredentialFlags {
  is_staff: boolean;
  is_loukou: boolean;
  is_garden_manager: boolean;
}

export async function updateUserCredentialsAction(
  userId: string,
  flags: CredentialFlags,
): Promise<RequestActionResult> {
  const supabase = await getAuthClient();
  if (!supabase) return { ok: false, error: "No autorizado." };

  const { data: isSuperuser } = await supabase.rpc("is_superuser");
  if (!isSuperuser) return { ok: false, error: "Solo un superusuario puede modificar credenciales." };

  const { error } = await createSupabaseAdminClient()
    .from("credentials")
    .update(flags)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setUserActiveAction(
  userId: string,
  isActive: boolean,
): Promise<RequestActionResult> {
  const supabase = await getAuthClient();
  if (!supabase) return { ok: false, error: "No autorizado." };

  const { error } = await createSupabaseAdminClient()
    .from("credentials")
    .update({ is_active: isActive })
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

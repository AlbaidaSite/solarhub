"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  requireStaffActionClient,
  requireSuperuserActionClient,
} from "../lib/actionAuth";

export type RequestActionResult = { ok: true } | { ok: false; error: string };

const PERFIL_PATH = "/staff/perfil";

export async function approveRequestAction(
  requestId: number,
): Promise<RequestActionResult> {
  const auth = await requireStaffActionClient();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("request")
    .update({ is_approved: true })
    .eq("id", requestId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(PERFIL_PATH);
  return { ok: true };
}

export async function denyRequestAction(
  requestId: number,
): Promise<RequestActionResult> {
  const auth = await requireStaffActionClient();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("request")
    .update({ is_approved: false })
    .eq("id", requestId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(PERFIL_PATH);
  return { ok: true };
}

export interface CredentialFlags {
  is_staff: boolean;
  is_loukou: boolean;
  is_garden_manager: boolean;
}

// `credentials` está protegida por RLS, así que la escritura usa el admin
// client; la autorización (superuser) la garantiza requireSuperuserActionClient.
export async function updateUserCredentialsAction(
  userId: string,
  flags: CredentialFlags,
): Promise<RequestActionResult> {
  const auth = await requireSuperuserActionClient();
  if (!auth.ok) return auth;

  const { error } = await createSupabaseAdminClient()
    .from("credentials")
    .update(flags)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(PERFIL_PATH);
  return { ok: true };
}

export async function setUserActiveAction(
  userId: string,
  isActive: boolean,
): Promise<RequestActionResult> {
  const auth = await requireStaffActionClient();
  if (!auth.ok) return auth;

  const { error } = await createSupabaseAdminClient()
    .from("credentials")
    .update({ is_active: isActive })
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(PERFIL_PATH);
  return { ok: true };
}

"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type EmailStatus =
  | "not_found"
  | "active"
  | "pending"
  | "can_reregister";

export async function checkEmailStatusAction(
  email: string,
): Promise<EmailStatus> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("get_email_registration_status", {
    p_email: email,
  });
  if (error || !data) return "not_found";
  return data as EmailStatus;
}

export type ReRegisterResult =
  | { ok: true }
  | { ok: false; error: string };

export async function reRegisterAction(
  email: string,
  password: string,
  username: string,
  message: string | null,
): Promise<ReRegisterResult> {
  const admin = createSupabaseAdminClient();

  // Resolve user_id from email
  const { data: userId, error: idErr } = await admin.rpc(
    "get_user_id_by_email",
    { p_email: email },
  );
  if (idErr || !userId) return { ok: false, error: "No se encontró la cuenta." };

  // Check username availability (excluding the same user's current username)
  const { data: unameTaken } = await admin.rpc("username_exists", {
    username_to_check: username,
  });
  if (unameTaken) {
    // Allow if it's the user's own existing username
    const { data: profile } = await admin
      .from("profile")
      .select("username")
      .eq("id", userId)
      .maybeSingle();
    if (!profile || profile.username.toLowerCase() !== username.toLowerCase()) {
      return { ok: false, error: "Ese usuario ya está en uso." };
    }
  }

  // Ensure account is inactive while request is pending
  await admin.from("credentials").update({ is_active: false }).eq("user_id", userId);

  // Update auth password
  const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
    password,
  });
  if (pwErr) return { ok: false, error: pwErr.message };

  // Update profile username
  const { error: profileErr } = await admin
    .from("profile")
    .update({ username })
    .eq("id", userId);
  if (profileErr) return { ok: false, error: profileErr.message };

  // Insert new request (is_approved defaults to null)
  const { error: reqErr } = await admin.from("request").insert({
    user_id: userId,
    message: message ?? null,
  });
  if (reqErr) return { ok: false, error: reqErr.message };

  return { ok: true };
}

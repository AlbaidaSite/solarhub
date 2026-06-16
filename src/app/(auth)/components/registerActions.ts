"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { DEFAULT_AVATAR_PATH } from "@/lib/supabase/storage";

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

export type SubmitRequestResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Formaliza una solicitud de registro NUEVA (estado "not_found").
 *
 * Se ejecuta enteramente en el servidor con el cliente admin (service_role)
 * porque el usuario aún no tiene sesión: crear el auth user y luego insertar
 * `profile`/`request` con el cliente anon del navegador choca con las políticas
 * RLS (`TO authenticated WITH CHECK (id = auth.uid())`). El service_role salta
 * RLS, así que aquí re-validamos a mano lo que RLS garantizaba: que el
 * `profile.id` es exactamente el uuid del auth user recién creado y que el
 * username está libre. `credentials` lo crea el trigger
 * `trg_create_credentials_for_profile` (todos los flags a false → cuenta
 * inactiva hasta que un staff aprueba la request).
 */
export async function submitRequestAction(
  email: string,
  password: string,
  username: string,
  name: string,
  message: string | null,
): Promise<SubmitRequestResult> {
  const admin = createSupabaseAdminClient();

  // Defensa en profundidad: este action solo formaliza altas nuevas.
  // Cuentas activas/pendientes o re-registrables se gestionan en otro flujo.
  const { data: status } = await admin.rpc("get_email_registration_status", {
    p_email: email,
  });
  if (status === "active") {
    return { ok: false, error: "Ya existe una cuenta activa con este correo." };
  }
  if (status === "pending") {
    return { ok: false, error: "Su solicitud aún se está evaluando." };
  }
  if (status && status !== "not_found") {
    return { ok: false, error: "No se puede crear la solicitud para este correo." };
  }

  // Username libre (el índice único sobre lower(username) es la red final).
  const { data: unameTaken } = await admin.rpc("username_exists", {
    username_to_check: username,
  });
  if (unameTaken) {
    return { ok: false, error: "Este username ya está en uso." };
  }

  // Parte 1: crear el auth user (server-side, sin depender de sesión).
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr || !created.user) {
    return { ok: false, error: authErr?.message ?? "No se pudo crear el usuario." };
  }
  const userId = created.user.id;

  // Parte 2a: profile (el trigger crea credentials inactivas).
  // profile_img arranca con el avatar compartido por defecto; el usuario
  // lo reemplaza luego subiendo el suyo a profiles/{user_id}/.
  const { error: profileErr } = await admin
    .from("profile")
    .insert({ id: userId, username, name, profile_img: DEFAULT_AVATAR_PATH });
  if (profileErr) {
    // Sin profile no hay cuenta utilizable: limpiamos el auth user huérfano.
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: profileErr.message };
  }

  // El trigger trg_create_credentials_for_profile ya crea las credenciales
  // con todos los flags a false, pero reforzamos is_active = false de forma
  // explícita por si el default del esquema remoto difiere: la cuenta solo
  // debe activarse al aprobar la request (trg_activate_credentials_on_request_approval).
  await admin
    .from("credentials")
    .update({ is_active: false })
    .eq("user_id", userId);

  // Parte 2b: request (is_approved defaults to null → pendiente).
  const { error: reqErr } = await admin
    .from("request")
    .insert({ user_id: userId, message: message ?? null });
  if (reqErr) {
    // Cascade desde auth.users limpia profile + credentials.
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: reqErr.message };
  }

  return { ok: true };
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

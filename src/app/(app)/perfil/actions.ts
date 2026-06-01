"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { DEFAULT_AVATAR_PATH, STORAGE_BUCKET } from "@/lib/supabase/storage";

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type AvatarActionResult = { ok: true } | { ok: false; error: string };

// La imagen ya llega recortada y reescalada a 512x512 .webp desde el cliente.
// Margen amplio sobre lo que debería ocupar ese webp (~50-150 KB).
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

// Sube el nuevo avatar a profiles/{userId}/{uuid}.webp, actualiza el perfil y
// borra la imagen anterior para que no se acumulen ficheros en el bucket.
// La subida y el update van con el cliente del usuario (RLS propia); el borrado
// del avatar anterior usa el admin client para que el cleanup no dependa de las
// policies (mismo motivo que safeRemoveFromBucket en cromoStorage.ts).
export async function updateAvatarAction(
  formData: FormData,
): Promise<AvatarActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no encontrada." };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No se ha recibido la imagen." };
  }
  if (file.type !== "image/webp") {
    return { ok: false, error: "La imagen debe ser .webp." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, error: "La imagen es demasiado grande." };
  }

  // Ruta de la imagen actual: la borraremos al final si el guardado va bien.
  const { data: profile } = await supabase
    .from("profile")
    .select("profile_img")
    .eq("id", user.id)
    .single();
  const oldPath = profile?.profile_img ?? null;

  const newPath = `profiles/${user.id}/${crypto.randomUUID()}.webp`;
  const { error: uploadErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(newPath, file, { contentType: "image/webp", upsert: false });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  const { error: dbErr } = await supabase
    .from("profile")
    .update({ profile_img: newPath })
    .eq("id", user.id);
  if (dbErr) {
    // El registro no se actualizó: deshacemos la subida para no dejar huérfanos.
    await supabase.storage.from(STORAGE_BUCKET).remove([newPath]).catch(() => {});
    return { ok: false, error: dbErr.message };
  }

  // Limpieza del avatar anterior con el admin client (bypassa RLS). Nunca
  // borramos el default compartido, ni rutas fuera de profiles/ por seguridad.
  if (
    oldPath &&
    oldPath !== DEFAULT_AVATAR_PATH &&
    oldPath !== newPath &&
    oldPath.startsWith("profiles/")
  ) {
    const { error: removeErr } = await createSupabaseAdminClient()
      .storage.from(STORAGE_BUCKET)
      .remove([oldPath]);
    if (removeErr) {
      // No es fatal: el avatar ya está actualizado. Solo lo dejamos en logs.
      console.error("No se pudo borrar el avatar anterior:", removeErr.message);
    }
  }

  revalidatePath("/perfil");
  return { ok: true };
}

export async function deactivateAccountAction() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await createSupabaseAdminClient()
    .from("credentials")
    .update({ is_active: false })
    .eq("user_id", user.id);

  await supabase.auth.signOut();
  redirect("/login");
}

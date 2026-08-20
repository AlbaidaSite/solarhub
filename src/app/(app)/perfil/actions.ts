"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireUserActionClient } from "@/lib/supabase/actionAuth";
import {
  DEFAULT_AVATAR_PATH,
  STORAGE_BUCKET,
  getStorageUrl,
  getThumbUrl,
} from "@/lib/supabase/storage";
import { buildCromoPath } from "@/app/(app)/cromos/lib/slug";

// Imagen que sustituye al frontal de un cromo que todavía no ha registrado
// nadie (misma convención que CromoCard.tsx / CromoModal.tsx).
const LOCKED_CROMO_PATH = "cromos/locked.webp";

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

// ─── Historial ───────────────────────────────────────────────────────────────

// Máximo de movimientos que devuelve el historial del perfil. Se aplica a
// cada fuente por separado ANTES de mezclarlas (una consulta que ya venga
// ordenada por fecha no puede aportar nada al top-20 global más allá de
// sus propias 20 primeras filas) y otra vez al resultado combinado.
const MAX_HISTORY_ENTRIES = 20;

// Una fila del historial, ya normalizada: cromos y pines comparten forma
// para que la lista solo tenga que ordenar por `createdAt` y pintar.
export interface HistoryEntry {
  kind: "cromo" | "pin";
  // Único dentro de la lista mezclada: el id numérico se repite entre
  // tablas (unique_ownership.id 3 y pin.id 3 conviven), así que la clave
  // de React lleva el tipo delante.
  key: string;
  // Instante ISO (timestamptz). En cromos es unique_ownership.date_acquired
  // y en pines pin.created_at — los dos son "cuándo pasó esto".
  createdAt: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  // Destino al pulsar la fila, o null si no hay vista a la que ir. Los
  // pines no tienen enlace profundo: el mapa abre su modal por estado
  // interno (ver GlobeClient.tsx), no por parámetro de URL.
  href: string | null;
}

type CromoHistoryRow = {
  id: number;
  date_acquired: string;
  unique_cromo: {
    copy_number: number;
    cromo: {
      id: number;
      name: string;
      front_img: string;
      cromo_labels: { has_owners: boolean } | null;
    } | null;
  } | null;
};

type PinHistoryRow = {
  id: number;
  place: string;
  state: string | null;
  created_at: string;
  sticker: { name: string; icon_path: string } | null;
  country: { name: string } | null;
};

// Movimientos del usuario — cromos registrados (o recibidos en un
// intercambio: el trigger de cierre inserta una fila nueva de
// unique_ownership, así que también cuentan como movimiento) y pines
// puestos en el mapa — del más reciente al más antiguo.
//
// Son dos tablas sin relación entre ellas, así que se piden en paralelo y
// se mezclan aquí en vez de en SQL. El orden final es por fecha
// descendente sobre la cadena ISO: al ser timestamptz siempre llega en
// UTC con el mismo formato, y ahí `localeCompare` ya ordena bien sin
// construir un Date por fila.
export async function getProfileHistoryAction(): Promise<HistoryEntry[]> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return [];
  const { supabase, userId } = auth;

  const [cromosRes, pinsRes] = await Promise.all([
    supabase
      .from("unique_ownership")
      .select(
        "id, date_acquired, unique_cromo!inner(copy_number, cromo:cromo_id!inner(id, name, front_img, cromo_labels:labels_id(has_owners)))",
      )
      .eq("user_id", userId)
      .order("date_acquired", { ascending: false })
      .limit(MAX_HISTORY_ENTRIES)
      .returns<CromoHistoryRow[]>(),
    supabase
      .from("pin")
      .select("id, place, state, created_at, sticker:sticker_id(name, icon_path), country:country_code(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_HISTORY_ENTRIES)
      .returns<PinHistoryRow[]>(),
  ]);

  if (cromosRes.error) {
    console.error("Error loading cromo history:", cromosRes.error.message);
  }
  if (pinsRes.error) {
    console.error("Error loading pin history:", pinsRes.error.message);
  }

  const entries: HistoryEntry[] = [];

  for (const row of cromosRes.data ?? []) {
    const cromo = row.unique_cromo?.cromo;
    if (!cromo) continue;
    // has_owners=false significa "nadie lo ha registrado nunca" y esconde
    // la imagen real tras locked.webp (ver CromoCard.tsx). Aquí no debería
    // darse — si el cromo está en TU historial es que lo registraste, y el
    // trigger set_has_owners_on_registration lo pone a true — pero el
    // fallback se respeta igual antes que filtrar una URL escondida.
    const locked = cromo.cromo_labels?.has_owners === false;
    entries.push({
      kind: "cromo",
      key: `cromo-${row.id}`,
      createdAt: row.date_acquired,
      title: cromo.name,
      subtitle: `Cromo · Copia #${row.unique_cromo?.copy_number ?? 0}`,
      imageUrl: locked ? getThumbUrl(LOCKED_CROMO_PATH) : getThumbUrl(cromo.front_img),
      href: buildCromoPath(cromo.id, cromo.name),
    });
  }

  for (const row of pinsRes.data ?? []) {
    const location = [row.state, row.country?.name].filter(Boolean).join(", ");
    entries.push({
      kind: "pin",
      key: `pin-${row.id}`,
      createdAt: row.created_at,
      title: row.place,
      subtitle: location ? `Pin · ${location}` : "Pin",
      imageUrl: row.sticker ? getStorageUrl(row.sticker.icon_path) : null,
      href: null,
    });
  }

  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return entries.slice(0, MAX_HISTORY_ENTRIES);
}

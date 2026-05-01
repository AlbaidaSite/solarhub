import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStorageUrl, getThumbUrl } from "@/lib/supabase/storage";
import type { CromoDetail } from "@/types/cromo";
import { buildIdSlug, parseIdSlug, slugify } from "./slug";
import { sortCromosDefault } from "./sort";

const LOCKED_IMG_PATH = "cromos/locked.webp";

interface CromoQueryRow {
  id: number;
  name: string;
  number: number;
  variant: number;
  description: string | null;
  copies: number;
  how_to: string | null;
  how_to_extended: string | null;
  front_img: string;
  back_img: string;
  cromo_labels: { has_owners: boolean; hide_til_registered: boolean; for_loukou: boolean } | null;
  rarity: { id: number; name: string; icon_path: string } | null;
  category: { id: number; name: string; icon_path: string; order_number: number } | null;
  cromo_artist: Array<{ artist: { name: string; url: string | null } | null }>;
}

const CROMO_SELECT = `id, name, number, variant, description, copies, how_to, how_to_extended, front_img, back_img,
  cromo_labels:labels_id(has_owners, hide_til_registered, for_loukou),
  rarity:rarity_id(id, name, icon_path),
  category:category_id(id, name, icon_path, order_number),
  cromo_artist(artist:artist_id(name, url))`;

// ─── Reglas de bloqueo (isLocked) ───────────────────────────────────────────
//
//  has_owners = false       → bloqueado para TODOS (nadie lo ha registrado).
//  hide_til_registered=true → bloqueado/oculto si el usuario no lo posee.
//  for_loukou=true          → bloqueado/oculto si el usuario no es loukou
//                             (is_loukou || is_superuser, según RPC).
//
function computeIsLocked(
  labels: { has_owners: boolean; hide_til_registered: boolean; for_loukou: boolean },
  userOwnsCromo: boolean,
  isUserLoukou: boolean,
): boolean {
  // La posesión propia anula cualquier label: el usuario siempre ve su cromo
  // desbloqueado, independientemente de hide_til_registered o for_loukou.
  if (userOwnsCromo) return false;
  if (!labels.has_owners) return true;
  if (labels.hide_til_registered) return true;
  if (labels.for_loukou && !isUserLoukou) return true;
  return false;
}

function mapToDetail(
  c: CromoQueryRow,
  userOwnsCromo: boolean,
  isUserLoukou: boolean,
): CromoDetail {
  const labels = c.cromo_labels!;
  const isLocked = computeIsLocked(labels, userOwnsCromo, isUserLoukou);
  const realFrontPath = isLocked ? LOCKED_IMG_PATH : c.front_img;
  // Defensa: para locked, back_img también apunta al placeholder, para que
  // ni siquiera se descargue el reverso real desde el cliente.
  const realBackPath = isLocked ? LOCKED_IMG_PATH : c.back_img;
  return {
    id: c.id,
    name: c.name,
    number: c.number,
    variant: c.variant,
    description: c.description,
    copies: c.copies,
    how_to: c.how_to,
    how_to_extended: c.how_to_extended,
    isLocked,
    front_img: getStorageUrl(realFrontPath),
    front_thumb: getThumbUrl(realFrontPath),
    back_img: getStorageUrl(realBackPath),
    rarity: c.rarity
      ? { id: c.rarity.id, name: c.rarity.name, icon_path: getStorageUrl(c.rarity.icon_path) }
      : null,
    category: c.category
      ? {
          id: c.category.id,
          name: c.category.name,
          icon_path: getStorageUrl(c.category.icon_path),
          order_number: c.category.order_number,
        }
      : null,
    artists: c.cromo_artist
      .map((ca) => ca.artist)
      .filter((a): a is { name: string; url: string | null } => a !== null),
  };
}

// ─── Visibilidad en álbum ────────────────────────────────────────────────────
//
//  hide_til_registered = true → solo aparece en el álbum si el usuario
//    actual lo tiene/tuvo (da igual si otro lo registró).
//
//  hide_til_registered = false → aparece siempre (bloqueado o desbloqueado).
//
function isVisibleInAlbum(
  c: CromoQueryRow,
  userOwnsCromo: boolean,
  isUserLoukou: boolean,
): boolean {
  const labels = c.cromo_labels;
  if (!labels) return false;
  // El usuario que posee el cromo lo ve siempre en su álbum, sin restricciones.
  if (userOwnsCromo) return true;
  if (labels.hide_til_registered) return false;
  if (labels.for_loukou && !isUserLoukou) return false;
  return true;
}

// ─── Obtener qué cromo_ids posee (o ha poseído) el usuario actual ──────────
async function fetchUserOwnedCromoIds(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<Set<number>> {
  const { data } = await supabase
    .from("unique_ownership")
    .select("unique_cromo!inner(cromo_id)")
    .eq("user_id", userId);

  const ids = new Set<number>();
  for (const row of (data ?? []) as unknown as Array<{ unique_cromo: { cromo_id: number } }>) {
    const cid = row.unique_cromo?.cromo_id;
    if (cid !== undefined) ids.add(cid);
  }
  return ids;
}

// ─── Fetch base (todas las filas, sin filtrar) ────────────────────────────
async function fetchRawCromoRows(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<CromoQueryRow[]> {
  const { data, error } = await supabase
    .from("cromo")
    .select(CROMO_SELECT)
    .order("number", { ascending: true })
    .order("variant", { ascending: true });

  if (error) throw new Error(`Error cargando cromos: ${error.message}`);
  return (data ?? []) as unknown as CromoQueryRow[];
}

// ─── API pública ─────────────────────────────────────────────────────────────

export async function fetchAllCromos(): Promise<CromoDetail[]> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  const [rows, userOwnedIds, loukou] = await Promise.all([
    fetchRawCromoRows(supabase),
    userId ? fetchUserOwnedCromoIds(supabase, userId) : Promise.resolve(new Set<number>()),
    userId ? supabase.rpc("is_loukou").then((r) => Boolean(r.data)) : Promise.resolve(false),
  ]);

  return rows
    .filter((c) => isVisibleInAlbum(c, userOwnedIds.has(c.id), loukou))
    .map((c) => mapToDetail(c, userOwnedIds.has(c.id), loukou));
}

export interface CromoNavigation {
  cromo: CromoDetail;
  prev: { idSlug: string } | null;
  next: { idSlug: string } | null;
}

export async function fetchCromoWithNeighbors(
  idSlug: string,
): Promise<CromoNavigation | null> {
  const parsed = parseIdSlug(idSlug);
  if (!parsed) return null;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  const [rows, userOwnedIds, loukou] = await Promise.all([
    fetchRawCromoRows(supabase),
    userId ? fetchUserOwnedCromoIds(supabase, userId) : Promise.resolve(new Set<number>()),
    userId ? supabase.rpc("is_loukou").then((r) => Boolean(r.data)) : Promise.resolve(false),
  ]);

  // Lista de vecinos (misma que el álbum: filtrada + ordenada).
  const albumList = sortCromosDefault(
    rows
      .filter((c) => isVisibleInAlbum(c, userOwnedIds.has(c.id), loukou))
      .map((c) => mapToDetail(c, userOwnedIds.has(c.id), loukou)),
  );

  // ¿Está el cromo solicitado en el álbum de este usuario?
  const albumIdx = albumList.findIndex((c) => c.id === parsed.id);

  if (albumIdx >= 0) {
    // Cromo visible en álbum → usa vecinos del álbum.
    const cromo = albumList[albumIdx];
    if (slugify(cromo.name) !== parsed.slug) return null;
    return {
      cromo,
      prev: albumIdx > 0
        ? { idSlug: buildIdSlug(albumList[albumIdx - 1].id, albumList[albumIdx - 1].name) }
        : null,
      next: albumIdx < albumList.length - 1
        ? { idSlug: buildIdSlug(albumList[albumIdx + 1].id, albumList[albumIdx + 1].name) }
        : null,
    };
  }

  // Cromo oculto en álbum (hide_til_registered / for_loukou y usuario sin acceso).
  // Lo devolvemos bloqueado sin prev/next para acceso directo por URL.
  const rawRow = rows.find((c) => c.id === parsed.id);
  if (!rawRow || !rawRow.cromo_labels) return null;
  const cromo = mapToDetail(rawRow, userOwnedIds.has(rawRow.id), loukou);
  if (slugify(cromo.name) !== parsed.slug) return null;
  return { cromo, prev: null, next: null };
}
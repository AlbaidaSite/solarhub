import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStorageUrl, getThumbUrl } from "@/lib/supabase/storage";
import type { CromoDetail, OwnedUnique } from "@/types/cromo";
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
function computeIsLocked(
  labels: { has_owners: boolean; hide_til_registered: boolean; for_loukou: boolean },
  userOwnsCromo: boolean,
  isUserLoukou: boolean,
): boolean {
  if (userOwnsCromo) return false;
  if (!labels.has_owners) return true;
  if (labels.hide_til_registered) return true;
  if (labels.for_loukou && !isUserLoukou) return true;
  return false;
}

// ─── Mapeo de fila DB → CromoDetail ──────────────────────────────────────────
function mapToDetail(
  c: CromoQueryRow,
  ownedUniques: OwnedUnique[],  // uniques que el usuario posee ACTUALMENTE de este cromo
  isUserLoukou: boolean,
): CromoDetail {
  const labels = c.cromo_labels!;
  const userOwnsCromo = ownedUniques.length > 0;
  const isLocked = computeIsLocked(labels, userOwnsCromo, isUserLoukou);
  const realFrontPath = isLocked ? LOCKED_IMG_PATH : c.front_img;
  const realBackPath  = isLocked ? LOCKED_IMG_PATH : c.back_img;
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
    userOwnedUniques: ownedUniques,
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
function isVisibleInAlbum(
  c: CromoQueryRow,
  userOwnsCromo: boolean,
  isUserLoukou: boolean,
): boolean {
  const labels = c.cromo_labels;
  if (!labels) return false;
  if (userOwnsCromo) return true;
  if (labels.hide_til_registered) return false;
  if (labels.for_loukou && !isUserLoukou) return false;
  return true;
}

// ─── Uniques que el usuario POSEE ACTUALMENTE por cromo ──────────────────────
// Retorna Map<cromo_id, OwnedUnique[]> para poder popular userOwnedUniques
// sin una sub-query por cada cromo.
async function fetchUserOwnedUniquesMap(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<Map<number, OwnedUnique[]>> {
  const { data } = await supabase
    .from("unique_ownership")
    .select("unique_cromo!inner(id, copy_number, cromo_id)")
    .eq("user_id", userId)
    .eq("is_current_owner", true);

  const map = new Map<number, OwnedUnique[]>();
  for (const row of (data ?? []) as unknown as Array<{
    unique_cromo: { id: number; copy_number: number; cromo_id: number };
  }>) {
    const uc = row.unique_cromo;
    if (!uc) continue;
    const list = map.get(uc.cromo_id) ?? [];
    list.push({ uniqueId: uc.id, copyNumber: uc.copy_number });
    map.set(uc.cromo_id, list);
  }
  return map;
}

// ─── Fetch base (todas las filas, sin filtrar) ────────────────────────────────
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

// ─── API pública ──────────────────────────────────────────────────────────────

export async function fetchAllCromos(): Promise<CromoDetail[]> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  const [rows, ownedMap, loukou] = await Promise.all([
    fetchRawCromoRows(supabase),
    userId
      ? fetchUserOwnedUniquesMap(supabase, userId)
      : Promise.resolve(new Map<number, OwnedUnique[]>()),
    userId ? supabase.rpc("is_loukou").then((r) => Boolean(r.data)) : Promise.resolve(false),
  ]);

  return rows
    .filter((c) => isVisibleInAlbum(c, ownedMap.has(c.id), loukou))
    .map((c) => mapToDetail(c, ownedMap.get(c.id) ?? [], loukou));
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

  const [rows, ownedMap, loukou] = await Promise.all([
    fetchRawCromoRows(supabase),
    userId
      ? fetchUserOwnedUniquesMap(supabase, userId)
      : Promise.resolve(new Map<number, OwnedUnique[]>()),
    userId ? supabase.rpc("is_loukou").then((r) => Boolean(r.data)) : Promise.resolve(false),
  ]);

  const albumList = sortCromosDefault(
    rows
      .filter((c) => isVisibleInAlbum(c, ownedMap.has(c.id), loukou))
      .map((c) => mapToDetail(c, ownedMap.get(c.id) ?? [], loukou)),
  );

  const albumIdx = albumList.findIndex((c) => c.id === parsed.id);

  if (albumIdx >= 0) {
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

  const rawRow = rows.find((c) => c.id === parsed.id);
  if (!rawRow || !rawRow.cromo_labels) return null;
  const cromo = mapToDetail(rawRow, ownedMap.get(rawRow.id) ?? [], loukou);
  if (slugify(cromo.name) !== parsed.slug) return null;
  return { cromo, prev: null, next: null };
}

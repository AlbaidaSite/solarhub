import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStorageUrl, getThumbUrl } from "@/lib/supabase/storage";
import type { CromoDetail, CromoOwnershipState, OwnedUnique } from "@/types/cromo";
import { buildIdSlug, parseIdSlug, slugify } from "./slug";
import { sortCromosDefault } from "./sort";

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

const LOCKED_IMG_PATH = "cromos/locked.webp";

// ─── Ownership state ─────────────────────────────────────────────────────────

function computeOwnershipState(
  currentlyOwned: OwnedUnique[],
  hasEverOwned: boolean,
): CromoOwnershipState {
  if (currentlyOwned.length > 0) return "owned";
  if (hasEverOwned) return "formerly_owned";
  return "never_owned";
}

// ─── Visibility in album ─────────────────────────────────────────────────────

function isVisibleInAlbum(
  labels: { hide_til_registered: boolean; for_loukou: boolean },
  hasEverOwned: boolean,
  isUserLoukou: boolean,
  isUserSuperuser: boolean,
): boolean {
  if (isUserSuperuser) return true;
  if (hasEverOwned) return true;
  if (labels.hide_til_registered) return false;
  if (labels.for_loukou && !isUserLoukou) return false;
  return true;
}

// ─── Map row → CromoDetail ───────────────────────────────────────────────────

function mapToDetail(
  c: CromoQueryRow,
  ownedUniques: OwnedUnique[],
  everOwnedEntry: { firstAcquiredAt: string } | undefined,
): CromoDetail {
  const labels = c.cromo_labels!;
  const hasEverOwned = everOwnedEntry !== undefined;
  // isImageLocked=true cuando has_owners=false: los componentes mostrarán
  // locked.webp en lugar de las URLs reales, que se almacenan igual para
  // que el modo dios (superusuario) pueda recuperarlas.
  const isImageLocked = !labels.has_owners;

  return {
    id: c.id,
    name: c.name,
    number: c.number,
    variant: c.variant,
    description: c.description,
    copies: c.copies,
    how_to: c.how_to,
    how_to_extended: c.how_to_extended,
    ownershipState: computeOwnershipState(ownedUniques, hasEverOwned),
    isImageLocked,
    firstAcquiredAt: everOwnedEntry?.firstAcquiredAt ?? null,
    userOwnedUniques: ownedUniques,
    front_img: getStorageUrl(c.front_img),
    front_thumb: getThumbUrl(c.front_img),
    back_img: getStorageUrl(c.back_img),
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

// ─── DB queries ───────────────────────────────────────────────────────────────

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

// Retorna Map<cromo_id, OwnedUnique[]> — copias que el usuario posee ACTUALMENTE.
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

// Retorna Map<cromo_id, { firstAcquiredAt }> — historial completo del usuario,
// con la fecha de adquisición más antigua por cromo (unique_ownership.date_acquired).
async function fetchUserEverOwnedMap(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<Map<number, { firstAcquiredAt: string }>> {
  const { data } = await supabase
    .from("unique_ownership")
    .select("date_acquired, unique_cromo!inner(cromo_id)")
    .eq("user_id", userId)
    .order("date_acquired", { ascending: true });

  const map = new Map<number, { firstAcquiredAt: string }>();
  for (const row of (data ?? []) as unknown as Array<{
    date_acquired: string | null;
    unique_cromo: { cromo_id: number };
  }>) {
    const cromoId = row.unique_cromo?.cromo_id;
    if (cromoId != null && !map.has(cromoId) && row.date_acquired) {
      map.set(cromoId, { firstAcquiredAt: row.date_acquired });
    }
  }
  return map;
}

// ─── Shared fetch helper ──────────────────────────────────────────────────────

async function fetchAlbumContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id;

  const [rows, ownedMap, everOwnedMap, loukou, superuser] = await Promise.all([
    fetchRawCromoRows(supabase),
    userId
      ? fetchUserOwnedUniquesMap(supabase, userId)
      : Promise.resolve(new Map<number, OwnedUnique[]>()),
    userId
      ? fetchUserEverOwnedMap(supabase, userId)
      : Promise.resolve(new Map<number, { firstAcquiredAt: string }>()),
    userId
      ? supabase.rpc("is_loukou").then((r) => Boolean(r.data))
      : Promise.resolve(false),
    userId
      ? supabase.rpc("is_superuser").then((r) => Boolean(r.data))
      : Promise.resolve(false),
  ]);

  return { rows, ownedMap, everOwnedMap, loukou, superuser };
}

// ─── API pública ──────────────────────────────────────────────────────────────

export async function fetchAllCromos(): Promise<{ cromos: CromoDetail[]; isSuperuser: boolean }> {
  const { rows, ownedMap, everOwnedMap, loukou, superuser } = await fetchAlbumContext();

  const cromos = rows
    .filter((c) => {
      if (!c.cromo_labels) return false;
      return isVisibleInAlbum(c.cromo_labels, everOwnedMap.has(c.id), loukou, superuser);
    })
    .map((c) => mapToDetail(c, ownedMap.get(c.id) ?? [], everOwnedMap.get(c.id)));

  return { cromos, isSuperuser: superuser };
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

  const { rows, ownedMap, everOwnedMap, loukou, superuser } = await fetchAlbumContext();

  const albumList = sortCromosDefault(
    rows
      .filter((c) => {
        if (!c.cromo_labels) return false;
        return isVisibleInAlbum(c.cromo_labels, everOwnedMap.has(c.id), loukou, superuser);
      })
      .map((c) => mapToDetail(c, ownedMap.get(c.id) ?? [], everOwnedMap.get(c.id))),
  );

  const albumIdx = albumList.findIndex((c) => c.id === parsed.id);
  if (albumIdx < 0) return null;

  const cromo = albumList[albumIdx];
  if (slugify(cromo.name) !== parsed.slug) return null;

  return {
    cromo,
    prev:
      albumIdx > 0
        ? { idSlug: buildIdSlug(albumList[albumIdx - 1].id, albumList[albumIdx - 1].name) }
        : null,
    next:
      albumIdx < albumList.length - 1
        ? { idSlug: buildIdSlug(albumList[albumIdx + 1].id, albumList[albumIdx + 1].name) }
        : null,
  };
}

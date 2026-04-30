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

function mapToDetail(c: CromoQueryRow): CromoDetail {
  const labels = c.cromo_labels!;
  const isLocked = !labels.has_owners && !labels.hide_til_registered;
  const realFrontPath = isLocked ? LOCKED_IMG_PATH : c.front_img;
  // Defensa: para locked, back_img también apunta al placeholder, para que ni siquiera
  // se descargue el reverso real desde el cliente.
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

function isVisibleToUser(c: CromoQueryRow): boolean {
  const labels = c.cromo_labels;
  if (!labels) return false;
  // hide_til_registered + sin owners reales → ocultar del álbum.
  if (!labels.has_owners && labels.hide_til_registered) return false;
  return true;
}

export async function fetchAllCromos(): Promise<CromoDetail[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cromo")
    .select(CROMO_SELECT)
    .order("number", { ascending: true })
    .order("variant", { ascending: true });

  if (error) {
    throw new Error(`Error cargando cromos: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as CromoQueryRow[];
  return rows.filter(isVisibleToUser).map(mapToDetail);
}

export interface CromoNavigation {
  cromo: CromoDetail;
  prev: { idSlug: string } | null;
  next: { idSlug: string } | null;
}

// Resuelve un cromo por su segmento `<id>-<slug>` y calcula sus vecinos
// usando el MISMO orden por defecto que el álbum (sortCromosDefault =
// Categoría asc > Número asc > Variante asc). De esta forma las flechas
// del modal navegan en el mismo orden visible que las cartas en el grid.
// 404 si:
//   · el formato del segmento no encaja
//   · el cromo no existe / no es visible
//   · el slug no coincide con el nombre real (anti-enumeración)
export async function fetchCromoWithNeighbors(
  idSlug: string,
): Promise<CromoNavigation | null> {
  const parsed = parseIdSlug(idSlug);
  if (!parsed) return null;

  const cromos = sortCromosDefault(await fetchAllCromos());
  const idx = cromos.findIndex((c) => c.id === parsed.id);
  if (idx < 0) return null;

  const cromo = cromos[idx];
  if (slugify(cromo.name) !== parsed.slug) return null;

  const prev =
    idx > 0
      ? { idSlug: buildIdSlug(cromos[idx - 1].id, cromos[idx - 1].name) }
      : null;
  const next =
    idx < cromos.length - 1
      ? { idSlug: buildIdSlug(cromos[idx + 1].id, cromos[idx + 1].name) }
      : null;

  return { cromo, prev, next };
}

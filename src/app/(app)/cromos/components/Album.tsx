import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getStorageUrl, getThumbUrl } from '@/lib/supabase/storage';
import type { CromoDetail } from '@/types/cromo';
import AlbumGrid from './AlbumGrid';

const LOCKED_IMG_PATH = 'cromos/locked.webp';

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
  rarity: { name: string; icon_path: string } | null;
  category: { name: string; icon_path: string } | null;
  cromo_artist: Array<{ artist: { name: string; url: string | null } | null }>;
}

export default async function Album() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('cromo')
    .select(
      `id, name, number, variant, description, copies, how_to, how_to_extended, front_img, back_img,
       cromo_labels:labels_id(has_owners, hide_til_registered, for_loukou),
       rarity:rarity_id(name, icon_path),
       category:category_id(name, icon_path),
       cromo_artist(artist:artist_id(name, url))`
    )
    .order('number', { ascending: true })
    .order('variant', { ascending: true });

  if (error) {
    return <p className="p-4 text-red-500">Error cargando cromos: {error.message}</p>;
  }

  const rows = (data ?? []) as unknown as CromoQueryRow[];

  const cromos: CromoDetail[] = rows
    .filter((c) => {
      const labels = c.cromo_labels;
      if (!labels) return false;
      if (!labels.has_owners && labels.hide_til_registered) return false;
      return true;
    })
    .map((c) => {
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
          ? { name: c.rarity.name, icon_path: getStorageUrl(c.rarity.icon_path) }
          : null,
        category: c.category
          ? { name: c.category.name, icon_path: getStorageUrl(c.category.icon_path) }
          : null,
        artists: c.cromo_artist
          .map((ca) => ca.artist)
          .filter((a): a is { name: string; url: string | null } => a !== null),
      };
    });

  return <AlbumGrid cromos={cromos} />;
}

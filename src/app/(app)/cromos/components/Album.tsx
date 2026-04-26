import CromoCard from './CromoCard';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getStorageUrl } from '@/lib/supabase/storage';
import type { CromoRow } from '@/types/cromo';

const LOCKED_IMG_PATH = 'cromos/locked.webp';

export default async function Album() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('cromo')
    .select(
      'id, name, number, variant, front_img, cromo_labels:labels_id(has_owners, hide_til_registered, for_loukou)'
    )
    .order('number', { ascending: true })
    .order('variant', { ascending: true });

  if (error) {
    return (
      <p className="p-4 text-red-500">Error cargando cromos: {error.message}</p>
    );
  }

  const rows = (data ?? []) as unknown as CromoRow[];

  const cromos = rows
    .filter((c) => {
      const labels = c.cromo_labels;
      if (!labels) return false;
      if (!labels.has_owners && labels.hide_til_registered) return false;
      return true;
    })
    .map((c) => {
      const labels = c.cromo_labels!;
      const isLocked = !labels.has_owners && !labels.hide_til_registered;
      return {
        id: c.id,
        name: c.name,
        number: c.number,
        variant: c.variant,
        front_img: getStorageUrl(isLocked ? LOCKED_IMG_PATH : c.front_img),
      };
    });

  return (
    <div className="grid justify-center grid-cols-[repeat(auto-fill,minmax(130px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-6 p-4">
      {cromos.map((cromo) => (
        <CromoCard key={`${cromo.number}-${cromo.variant}`} cromo={cromo} />
      ))}
    </div>
  );
}

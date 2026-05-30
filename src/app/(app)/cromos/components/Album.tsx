import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStorageUrl } from "@/lib/supabase/storage";
import type { Category, CromoDetail, Rarity } from "@/types/cromo";
import { fetchAllCromos } from "../lib/cromos-fetch";
import AlbumGrid from "./AlbumGrid";

interface CategoryQueryRow {
  id: number;
  name: string;
  icon_path: string;
  order_number: number;
}

interface RarityQueryRow {
  id: number;
  name: string;
  icon_path: string;
}

export default async function Album() {
  const supabase = await createSupabaseServerClient();

  let cromos: CromoDetail[];
  let isSuperuser: boolean;
  try {
    ({ cromos, isSuperuser } = await fetchAllCromos());
  } catch (err) {
    return <p className="p-4 text-red-500">{(err as Error).message}</p>;
  }

  const [categoriesRes, raritiesRes] = await Promise.all([
    supabase
      .from("category")
      .select("id, name, icon_path, order_number")
      .order("order_number", { ascending: true })
      .returns<CategoryQueryRow[]>(),
    supabase
      .from("rarity")
      .select("id, name, icon_path")
      .order("id", { ascending: true })
      .returns<RarityQueryRow[]>(),
  ]);

  if (categoriesRes.error) {
    return <p className="p-4 text-red-500">Error cargando categorías: {categoriesRes.error.message}</p>;
  }
  if (raritiesRes.error) {
    return <p className="p-4 text-red-500">Error cargando rarezas: {raritiesRes.error.message}</p>;
  }

  const categories: Category[] = (categoriesRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    icon_path: getStorageUrl(c.icon_path),
    order_number: c.order_number,
  }));

  const rarities: Rarity[] = (raritiesRes.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    icon_path: getStorageUrl(r.icon_path),
  }));

  return (
    <AlbumGrid
      cromos={cromos}
      categories={categories}
      rarities={rarities}
      isSuperuser={isSuperuser}
    />
  );
}

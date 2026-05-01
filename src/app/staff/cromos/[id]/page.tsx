import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireStaff } from "../../lib/auth";
import StaffBackButton from "../../components/StaffBackButton";
import CromoEditForm from "./components/CromoEditForm";

export const metadata: Metadata = { title: "Staff · Editar cromo | SolarHub" };

interface CromoFullRow {
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
  labels_id: number;
  cromo_labels: {
    id: number;
    has_owners: boolean;
    hide_til_registered: boolean;
    for_loukou: boolean;
    allow_multiple_users: boolean;
  } | null;
  category: { id: number } | null;
  rarity: { id: number } | null;
  cromo_artist: Array<{ artist_id: number }>;
  unique_cromo: Array<{ id: number; code: number; copy_number: number }>;
}

export default async function StaffEditCromoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await requireStaff();
  const { id } = await params;
  const cromoId = parseInt(id, 10);
  if (isNaN(cromoId)) notFound();

  const [cromoRes, catRes, rarRes, artRes] = await Promise.all([
    supabase
      .from("cromo")
      .select(
        `id, name, number, variant, description, copies, how_to, how_to_extended,
         front_img, back_img, labels_id,
         cromo_labels:labels_id(id, has_owners, hide_til_registered, for_loukou, allow_multiple_users),
         category:category_id(id),
         rarity:rarity_id(id),
         cromo_artist(artist_id),
         unique_cromo(id, code, copy_number)`,
      )
      .eq("id", cromoId)
      .single(),
    supabase
      .from("category")
      .select("id, name")
      .order("order_number", { ascending: true }),
    supabase.from("rarity").select("id, name").order("id", { ascending: true }),
    supabase.from("artist").select("id, name").order("name", { ascending: true }),
  ]);

  if (cromoRes.error || !cromoRes.data) notFound();
  if (catRes.error)
    return <p className="p-6 text-red-400">Error categorías: {catRes.error.message}</p>;
  if (rarRes.error)
    return <p className="p-6 text-red-400">Error rarezas: {rarRes.error.message}</p>;
  if (artRes.error)
    return <p className="p-6 text-red-400">Error artistas: {artRes.error.message}</p>;

  const cromo = cromoRes.data as unknown as CromoFullRow;

  const existingUniques = [...(cromo.unique_cromo ?? [])].sort(
    (a, b) => a.copy_number - b.copy_number,
  );

  return (
    <div className="relative w-full min-h-full p-6 flex flex-col gap-6">
      <div className="absolute top-4 left-4">
        <StaffBackButton href="/staff/cromos" label="Volver al listado" />
      </div>

      <h1 className="text-3xl font-bold text-white text-center mt-12">
        Editar cromo #{cromo.number} — {cromo.name}
      </h1>

      <CromoEditForm
        cromoId={cromo.id}
        labelsId={cromo.labels_id}
        initial={{
          name: cromo.name,
          description: cromo.description ?? "",
          number: String(cromo.number),
          categoryId: String(cromo.category?.id ?? ""),
          rarityId: String(cromo.rarity?.id ?? ""),
          howTo: cromo.how_to ?? "",
          howToExtended: cromo.how_to_extended ?? "",
          copies: String(cromo.copies),
          allowMultiple: cromo.cromo_labels?.allow_multiple_users ?? false,
          forLoukou: cromo.cromo_labels?.for_loukou ?? false,
          artistIds: cromo.cromo_artist.map((ca) => ca.artist_id),
          frontImgPath: cromo.front_img,
          backImgPath: cromo.back_img,
        }}
        initialCodes={existingUniques.map((u) => String(u.code))}
        categories={catRes.data ?? []}
        rarities={rarRes.data ?? []}
        artists={artRes.data ?? []}
      />
    </div>
  );
}

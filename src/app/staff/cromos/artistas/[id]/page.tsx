import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireStaff } from "../../../lib/auth";
import StaffBackButton from "../../../components/StaffBackButton";
import ArtistForm from "../components/ArtistForm";
import { updateArtistAction } from "../actions";

export const metadata: Metadata = { title: "Staff · Editar artista | SolarHub" };

export default async function StaffEditArtistaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await requireStaff();
  const { id } = await params;
  const artistId = parseInt(id, 10);
  if (isNaN(artistId)) notFound();

  const { data, error } = await supabase
    .from("artist")
    .select("id, name, url")
    .eq("id", artistId)
    .single();

  if (error || !data) notFound();

  // Vincular el id a la action antes de pasarla al cliente.
  const boundAction = updateArtistAction.bind(null, artistId);

  return (
    <div className="relative w-full min-h-full p-6 flex flex-col items-center gap-8">
      <div className="absolute top-4 left-4">
        <StaffBackButton href="/staff/cromos/artistas" label="Volver a Artistas" />
      </div>

      <h1 className="text-3xl font-bold text-white text-center mt-12">
        Editar artista — {data.name}
      </h1>

      <ArtistForm
        initial={{ name: data.name, url: data.url ?? "" }}
        submitLabel="Guardar cambios"
        action={boundAction}
      />
    </div>
  );
}

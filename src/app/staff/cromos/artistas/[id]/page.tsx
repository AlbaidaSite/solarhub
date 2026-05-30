import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireStaff } from "../../../lib/auth";
import StaffPageShell from "../../../components/StaffPageShell";
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

  const boundAction = updateArtistAction.bind(null, artistId);

  return (
    <StaffPageShell
      title={`Editar artista — ${data.name}`}
      backHref="/staff/cromos/artistas"
      backLabel="Volver a Artistas"
      variant="form"
    >
      <ArtistForm
        initial={{ name: data.name, url: data.url ?? "" }}
        submitLabel="Guardar cambios"
        action={boundAction}
      />
    </StaffPageShell>
  );
}

import type { Metadata } from "next";

import { requireStaff } from "../../../lib/auth";
import StaffPageShell from "../../../components/StaffPageShell";
import ArtistForm from "../components/ArtistForm";
import { createArtistAction } from "../actions";

export const metadata: Metadata = { title: "Staff · Crear artista | SolarHub" };

export default async function StaffCrearArtistaPage() {
  await requireStaff();

  return (
    <StaffPageShell
      title="Crear artista"
      backHref="/staff/cromos/artistas"
      backLabel="Volver a Artistas"
      variant="form"
    >
      <ArtistForm submitLabel="Crear artista" action={createArtistAction} />
    </StaffPageShell>
  );
}

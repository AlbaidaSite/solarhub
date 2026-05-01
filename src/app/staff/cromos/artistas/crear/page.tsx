import type { Metadata } from "next";

import { requireStaff } from "../../../lib/auth";
import StaffBackButton from "../../../components/StaffBackButton";
import ArtistForm from "../components/ArtistForm";
import { createArtistAction } from "../actions";

export const metadata: Metadata = { title: "Staff · Crear artista | SolarHub" };

export default async function StaffCrearArtistaPage() {
  await requireStaff();

  return (
    <div className="relative w-full min-h-full p-6 flex flex-col items-center gap-8">
      <div className="absolute top-4 left-4">
        <StaffBackButton href="/staff/cromos/artistas" label="Volver a Artistas" />
      </div>

      <h1 className="text-3xl font-bold text-white text-center mt-12">Crear artista</h1>

      <ArtistForm
        submitLabel="Crear artista"
        action={createArtistAction}
      />
    </div>
  );
}

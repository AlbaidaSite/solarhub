import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { requireStaff } from "../../lib/auth";
import StaffBackButton from "../../components/StaffBackButton";
import ArtistAdminList from "./components/ArtistAdminList";

export const metadata: Metadata = { title: "Staff · Artistas | SolarHub" };

export default async function StaffArtistasPage() {
  const supabase = await requireStaff();

  const { data, error } = await supabase
    .from("artist")
    .select("id, name, url")
    .order("name", { ascending: true });

  if (error)
    return <p className="p-6 text-red-400">Error cargando artistas: {error.message}</p>;

  return (
    <div className="relative w-full min-h-full p-6 flex flex-col gap-6">
      <div className="absolute top-4 left-4">
        <StaffBackButton href="/staff/cromos" label="Volver a Cromos" />
      </div>

      <h1 className="text-3xl font-bold text-white text-center mt-12">Artistas</h1>

      <div className="flex justify-end">
        <Link
          href="/staff/cromos/artistas/crear"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow transition-colors"
        >
          <Plus size={18} strokeWidth={2.5} />
          Crear Artista
        </Link>
      </div>

      <ArtistAdminList artists={data ?? []} />
    </div>
  );
}

import type { Metadata } from "next";
import { requireStaff } from "../../lib/auth";
import StaffBackButton from "../../components/StaffBackButton";
import CromoCreateForm from "./components/CromoCreateForm";

export const metadata: Metadata = { title: "Staff · Crear cromo | SolarHub" };

export default async function StaffCrearCromoPage() {
  const supabase = await requireStaff();

  const [catRes, rarRes, artRes] = await Promise.all([
    supabase
      .from("category")
      .select("id, name")
      .order("order_number", { ascending: true }),
    supabase.from("rarity").select("id, name").order("id", { ascending: true }),
    supabase.from("artist").select("id, name").order("name", { ascending: true }),
  ]);

  if (catRes.error)
    return <p className="p-6 text-red-400">Error cargando categorías: {catRes.error.message}</p>;
  if (rarRes.error)
    return <p className="p-6 text-red-400">Error cargando rarezas: {rarRes.error.message}</p>;
  if (artRes.error)
    return <p className="p-6 text-red-400">Error cargando artistas: {artRes.error.message}</p>;

  return (
    <div className="relative w-full min-h-full p-6 flex flex-col gap-6">
      <div className="absolute top-4 left-4">
        <StaffBackButton href="/staff/cromos" label="Volver al listado" />
      </div>

      <h1 className="text-3xl font-bold text-white text-center mt-12">Crear cromo</h1>

      <CromoCreateForm
        categories={catRes.data ?? []}
        rarities={rarRes.data ?? []}
        artists={artRes.data ?? []}
      />
    </div>
  );
}

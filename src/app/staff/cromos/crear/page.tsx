import type { Metadata } from "next";
import { requireStaff } from "../../lib/auth";
import StaffPageShell from "../../components/StaffPageShell";
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
    <StaffPageShell
      title="Crear cromo"
      backHref="/staff/cromos"
      backLabel="Volver al listado"
    >
      <CromoCreateForm
        categories={catRes.data ?? []}
        rarities={rarRes.data ?? []}
        artists={artRes.data ?? []}
      />
    </StaffPageShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Paintbrush, Plus } from "lucide-react";
import { requireStaff } from "../lib/auth";
import StaffBackButton from "../components/StaffBackButton";
import CromoAdminList from "./components/CromoAdminList";

export const metadata: Metadata = { title: "Staff · Cromos | SolarHub" };

interface CromoQueryRow {
  id: number;
  name: string;
  number: number;
  variant: number;
  category: { name: string } | null;
}

export default async function StaffCromosPage() {
  const supabase = await requireStaff();

  const { data, error } = await supabase
    .from("cromo")
    .select("id, name, number, variant, category:category_id(name)")
    .order("id", { ascending: true });

  if (error) {
    return (
      <p className="p-6 text-red-400">Error cargando cromos: {error.message}</p>
    );
  }

  const cromos = (data ?? []) as unknown as CromoQueryRow[];

  return (
    <div className="relative w-full min-h-full p-6 flex flex-col gap-6">
      <div className="absolute top-4 left-4">
        <StaffBackButton />
      </div>

      <h1 className="text-3xl font-bold text-white text-center mt-12">Cromos</h1>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/staff/cromos/artistas"
          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white font-semibold shadow transition-colors"
        >
          <Paintbrush size={18} strokeWidth={2.5} />
          Artistas
        </Link>

        <Link
          href="/staff/cromos/crear"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow transition-colors"
        >
          <Plus size={18} strokeWidth={2.5} />
          Crear Cromo
        </Link>
      </div>

      <CromoAdminList cromos={cromos} />
    </div>
  );
}

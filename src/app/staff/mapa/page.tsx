import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStaff } from "../lib/auth";
import StaffBackButton from "../components/StaffBackButton";
import StickerAdminList from "./components/StickerAdminList";
import { getStorageUrl } from "@/lib/supabase/storage";

export const metadata: Metadata = { title: "Staff · Mapa | SolarHub" };

export default async function StaffMapaPage() {
  const supabase = await requireStaff();

  const { data, error } = await supabase
    .from("sticker")
    .select("id, name, icon_path")
    .order("name", { ascending: true });

  if (error) {
    return (
      <p className="p-6 text-red-400">Error cargando stickers: {error.message}</p>
    );
  }

  const stickers = (data ?? []).map((row) => ({
    id: row.id as number,
    name: row.name as string,
    iconUrl: getStorageUrl(row.icon_path as string),
  }));

  return (
    <div className="relative w-full min-h-full p-6 flex flex-col gap-6">
      <div className="absolute top-4 left-4">
        <StaffBackButton />
      </div>

      <h1 className="text-3xl font-bold text-white text-center mt-12">Mapa</h1>

      <div className="flex items-center justify-end">
        <Link
          href="/staff/mapa/stickers/crear"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow transition-colors"
        >
          <Plus size={18} strokeWidth={2.5} />
          Crear Sticker
        </Link>
      </div>

      <StickerAdminList stickers={stickers} />
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "../../../lib/auth";
import StaffBackButton from "../../../components/StaffBackButton";
import StickerForm from "../../components/StickerForm";
import { updateStickerAction } from "../../actions";
import { getStorageUrl } from "@/lib/supabase/storage";

export const metadata: Metadata = { title: "Staff · Editar Sticker | SolarHub" };

export default async function StaffEditStickerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await requireStaff();
  const { id } = await params;
  const stickerId = parseInt(id, 10);
  if (isNaN(stickerId)) notFound();

  const { data, error } = await supabase
    .from("sticker")
    .select("id, name, icon_path")
    .eq("id", stickerId)
    .single();

  if (error || !data) notFound();

  const boundAction = updateStickerAction.bind(null, stickerId);

  return (
    <div className="relative w-full min-h-full p-6 flex flex-col items-center gap-8">
      <div className="absolute top-4 left-4">
        <StaffBackButton href="/staff/mapa" label="Volver a Mapa" />
      </div>

      <h1 className="text-3xl font-bold text-white text-center mt-12">
        Editar Sticker — {data.name as string}
      </h1>

      <StickerForm
        existingIconUrl={getStorageUrl(data.icon_path as string)}
        initial={{ name: data.name as string }}
        submitLabel="Guardar cambios"
        action={boundAction}
      />
    </div>
  );
}

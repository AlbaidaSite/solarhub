import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "../../../lib/auth";
import StaffPageShell from "../../../components/StaffPageShell";
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
    <StaffPageShell
      title={`Editar Sticker — ${data.name as string}`}
      backHref="/staff/mapa"
      backLabel="Volver a Mapa"
      variant="form"
    >
      <StickerForm
        existingIconUrl={getStorageUrl(data.icon_path as string)}
        initial={{ name: data.name as string }}
        submitLabel="Guardar cambios"
        action={boundAction}
      />
    </StaffPageShell>
  );
}

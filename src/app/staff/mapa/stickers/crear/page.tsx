import type { Metadata } from "next";
import { requireStaff } from "../../../lib/auth";
import StaffPageShell from "../../../components/StaffPageShell";
import StickerForm from "../../components/StickerForm";
import { createStickerAction } from "../../actions";

export const metadata: Metadata = { title: "Staff · Crear Sticker | SolarHub" };

export default async function StaffCrearStickerPage() {
  await requireStaff();

  return (
    <StaffPageShell
      title="Crear Sticker"
      backHref="/staff/mapa"
      backLabel="Volver a Mapa"
      variant="form"
    >
      <StickerForm submitLabel="Crear sticker" action={createStickerAction} />
    </StaffPageShell>
  );
}

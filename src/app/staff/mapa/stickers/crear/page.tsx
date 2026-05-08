import type { Metadata } from "next";
import { requireStaff } from "../../../lib/auth";
import StaffBackButton from "../../../components/StaffBackButton";
import StickerForm from "../../components/StickerForm";
import { createStickerAction } from "../../actions";

export const metadata: Metadata = { title: "Staff · Crear Sticker | SolarHub" };

export default async function StaffCrearStickerPage() {
  await requireStaff();

  return (
    <div className="relative w-full min-h-full p-6 flex flex-col items-center gap-8">
      <div className="absolute top-4 left-4">
        <StaffBackButton href="/staff/mapa" label="Volver a Mapa" />
      </div>

      <h1 className="text-3xl font-bold text-white text-center mt-12">Crear Sticker</h1>

      <StickerForm
        submitLabel="Crear sticker"
        action={createStickerAction}
      />
    </div>
  );
}

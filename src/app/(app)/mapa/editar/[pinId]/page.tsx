import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  checkPinEditPermissionAction,
  getPinDetailAction,
  getStickersAction,
  getCountriesAction,
} from "../../actions";
import EditPinForm from "./components/EditPinForm";

export const metadata: Metadata = { title: "Editar pegatina | SolarHub" };

export default async function EditarPegatina({
  params,
}: {
  params: Promise<{ pinId: string }>;
}) {
  const { pinId: pinIdStr } = await params;
  const pinId = parseInt(pinIdStr, 10);
  if (isNaN(pinId)) redirect("/mapa");

  const [canEdit, detail, stickers, countries] = await Promise.all([
    checkPinEditPermissionAction(pinId),
    getPinDetailAction(pinId),
    getStickersAction(),
    getCountriesAction(),
  ]);

  if (!canEdit || !detail) redirect("/mapa");

  return <EditPinForm detail={detail} stickers={stickers} countries={countries} />;
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  checkEventEditPermissionAction,
  getCurrentUserRoleFlagsAction,
  getEventForEditAction,
  getEventTypesAction,
} from "../../actions";
import EditEventForm from "./components/EditEventForm";

export const metadata: Metadata = { title: "Editar evento | SolarHub" };

export default async function EditarEventoPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId: eventIdStr } = await params;
  const eventId = parseInt(eventIdStr, 10);
  if (isNaN(eventId)) redirect("/eventos");

  const [permission, detail, eventTypes, { isStaff, isLoukou }] = await Promise.all([
    checkEventEditPermissionAction(eventId),
    getEventForEditAction(eventId),
    getEventTypesAction(),
    getCurrentUserRoleFlagsAction(),
  ]);

  if (!(permission.isOwner || permission.isStaff) || !detail) redirect("/eventos");

  return (
    <EditEventForm
      detail={detail}
      eventTypes={eventTypes}
      isStaff={isStaff}
      isLoukou={isLoukou}
    />
  );
}

import type { Metadata } from "next";
import { getCurrentUserRoleFlagsAction, getEventTypesAction } from "../actions";
import NewEventForm from "./components/NewEventForm";

export const metadata: Metadata = { title: "Nuevo evento | SolarHub" };

interface NuevoEventoPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function NuevoEventoPage({ searchParams }: NuevoEventoPageProps) {
  const { date } = await searchParams;

  const [eventTypes, { isStaff, isLoukou }] = await Promise.all([
    getEventTypesAction(),
    getCurrentUserRoleFlagsAction(),
  ]);

  return (
    <NewEventForm
      eventTypes={eventTypes}
      isStaff={isStaff}
      isLoukou={isLoukou}
      initialDate={date ?? null}
    />
  );
}

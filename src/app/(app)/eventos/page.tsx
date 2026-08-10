import type { Metadata } from "next";
import { Suspense } from "react";
import EventsCalendar from "./components/EventsCalendar";
import { getEventOccurrencesInRangeAction } from "./actions";
import { getMonthGridRange } from "./lib/gridRange";

export const metadata: Metadata = { title: "Eventos | SolarHub" };

export default async function EventosPage() {
  const now = new Date();
  const range = getMonthGridRange(now.getFullYear(), now.getMonth() + 1);
  const occurrences = await getEventOccurrencesInRangeAction(range.start, range.end);

  // EventsCalendar usa useSearchParams (enlace compartido a un evento
  // concreto, ?evento=&fecha=) — Next.js exige un límite de Suspense por
  // encima de cualquier componente que lo use.
  return (
    <Suspense fallback={null}>
      <EventsCalendar initialOccurrences={occurrences} />
    </Suspense>
  );
}

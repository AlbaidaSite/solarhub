import type { Metadata } from "next";
import EventsCalendar from "./components/EventsCalendar";
import { getEventOccurrencesInRangeAction } from "./actions";
import { getMonthGridRange } from "./lib/gridRange";

export const metadata: Metadata = { title: "Eventos | SolarHub" };

export default async function EventosPage() {
  const now = new Date();
  const range = getMonthGridRange(now.getFullYear(), now.getMonth() + 1);
  const occurrences = await getEventOccurrencesInRangeAction(range.start, range.end);

  return <EventsCalendar initialOccurrences={occurrences} />;
}

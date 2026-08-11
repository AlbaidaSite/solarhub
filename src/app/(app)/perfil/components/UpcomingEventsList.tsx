"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { toggleEventInterestAction } from "@/app/(app)/eventos/actions";
import EventListRow from "@/app/(app)/eventos/components/EventListRow";
import type { EventOccurrence } from "@/types/events";

interface UpcomingEventsListProps {
  initialEvents: EventOccurrence[];
}

// "YYYY-MM" de occurrenceDate, sin pasar por Date/zona horaria (mismo
// motivo que el resto de derivaciones sobre occurrenceDate: ya viene
// proyectada a su día real en Europe/Madrid, reinterpretarla arriesga un
// desfase de día en los bordes de mes).
function monthKey(occurrenceDate: string): string {
  return occurrenceDate.slice(0, 7);
}

function monthLabel(occurrenceDate: string): string {
  const [year, month] = occurrenceDate.split("-").map(Number);
  const raw = new Intl.DateTimeFormat("es-ES", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// "Eventos pendientes" del perfil: todo lo que el usuario ha marcado con
// la campana, próximo primero. Mismo tratamiento visual que el listado
// del día en móvil (EventListModal.tsx) — misma fila, mismo botón de
// interés — con la fecha añadida a la izquierda porque aquí, a
// diferencia de ahí, no hay una cabecera de día que ya la dé por sabida.
export default function UpcomingEventsList({ initialEvents }: UpcomingEventsListProps) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());

  function handleSelect(eventId: number) {
    const occurrence = events.find((o) => o.id === eventId);
    if (!occurrence) return;
    router.push(`/eventos?evento=${eventId}&fecha=${occurrence.occurrenceDate}`);
  }

  // Todo lo que aparece aquí ya está marcado, así que la campana solo
  // puede ir en un sentido: quitar interés. Optimista al estilo
  // Instagram — desaparece de la lista al instante y solo vuelve a
  // aparecer si la petición termina fallando (o si, por lo que sea, el
  // servidor responde que sigue marcado).
  function handleToggleInterest(occurrence: EventOccurrence) {
    const eventId = occurrence.id;
    setPendingIds((prev) => new Set(prev).add(eventId));
    setEvents((prev) => prev.filter((o) => o.id !== eventId));

    toggleEventInterestAction(eventId)
      .then((result) => {
        if (result.ok && !result.liked) return;
        if (!result.ok) console.error("UpcomingEventsList: fallo al quitar el interés", result.error);
        setEvents((prev) => {
          if (prev.some((o) => o.id === eventId)) return prev;
          return [...prev, occurrence].sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));
        });
      })
      .finally(() => {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
      });
  }

  if (events.length === 0) {
    return <p className="text-white/50 text-sm">No hay eventos marcados con interés.</p>;
  }

  return (
    <ul className="flex w-full max-h-[60vh] flex-col gap-2 overflow-y-auto scrollbar-clean pr-1">
      {events.map((occurrence, index) => {
        // Cabecera de mes solo al entrar en un mes nuevo — si un mes no
        // tiene eventos, sencillamente no hay ningún occurrence con esa
        // monthKey y su nombre nunca se genera (no se itera un calendario
        // fijo de 12 meses, solo los datos que hay).
        const showMonthHeader = index === 0 || monthKey(occurrence.occurrenceDate) !== monthKey(events[index - 1].occurrenceDate);
        return (
          <Fragment key={occurrence.id}>
            {showMonthHeader && (
              <li className="px-1 pt-2 text-sm font-semibold text-white/70 first:pt-0">
                {monthLabel(occurrence.occurrenceDate)}
              </li>
            )}
            <li>
              <EventListRow
                occurrence={occurrence}
                onSelect={handleSelect}
                onToggleInterest={handleToggleInterest}
                isInterestPending={pendingIds.has(occurrence.id)}
                showDateBadge
                lighterBorder
              />
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}

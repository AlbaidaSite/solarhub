import type { EventOccurrence } from "@/types/events";
import { isBirthday } from "@/types/events";

const MAX_VISIBLE_DOTS = 6;

// Agrupa preservando el orden que devuelve el RPC (occurrence_date, hora
// local, id) — ese orden es lo que define cuál es el evento por defecto de
// cada celda.
export function groupOccurrencesByDate(
  occurrences: EventOccurrence[],
): Map<string, EventOccurrence[]> {
  const map = new Map<string, EventOccurrence[]>();
  for (const occurrence of occurrences) {
    const list = map.get(occurrence.occurrenceDate);
    if (list) list.push(occurrence);
    else map.set(occurrence.occurrenceDate, [occurrence]);
  }
  return map;
}

// El primer evento según el orden del RPC, salvo que ya se haya
// seleccionado otro por hover/foco (eso lo gestiona el componente cliente).
export function getDefaultOccurrence(
  dayOccurrences: EventOccurrence[],
): EventOccurrence | null {
  return dayOccurrences[0] ?? null;
}

export interface DotSequence {
  visible: EventOccurrence[];
  overflowCount: number;
}

// Máximo 6 puntos visibles. A partir del séptimo evento, se sustituyen los
// puntos individuales sobrantes por un único punto neutro que representa
// el resto (nunca se superan 6 puntos en pantalla).
function buildDotSequence(source: EventOccurrence[]): DotSequence {
  if (source.length <= MAX_VISIBLE_DOTS) {
    return { visible: source, overflowCount: 0 };
  }
  const visible = source.slice(0, MAX_VISIBLE_DOTS - 1);
  return { visible, overflowCount: source.length - visible.length };
}

// Escritorio: los cumpleaños no generan punto (van en la pastilla superior).
export function getDesktopDotSequence(dayOccurrences: EventOccurrence[]): DotSequence {
  return buildDotSequence(dayOccurrences.filter((o) => !isBirthday(o)));
}

// Móvil: los cumpleaños tampoco generan punto (van en el destello único de
// CalendarCell.tsx, uno por día sin importar cuántos cumpleaños haya) — la
// lógica queda idéntica a escritorio, se mantiene como función aparte por
// claridad de nombre en el punto de uso.
export function getMobileDotSequence(dayOccurrences: EventOccurrence[]): DotSequence {
  return buildDotSequence(dayOccurrences.filter((o) => !isBirthday(o)));
}

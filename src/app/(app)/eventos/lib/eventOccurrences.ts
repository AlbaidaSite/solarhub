import type { EventOccurrence } from "@/types/events";
import { isBirthday } from "@/types/events";
import { madridIsoDate } from "./formatting";

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

// ─── Eventos ya pasados ──────────────────────────────────────────────────────
// Un evento "pasado" es el que ya terminó y no volverá: hoy eso es todo lo
// que no sea un cumpleaños, porque la recurrencia YEARLY solo se pone en
// eventos de tipo cumpleaños (ver `recurrence: isBirthdayType ? ...` en
// NewEventForm/EditEventForm). Un cumpleaños se repite cada año, así que
// nunca queda atrás por mucho que se mire una ocurrencia antigua.

// Último día que ocupa la ocurrencia, en Europe/Madrid. En un evento anual
// end_date guarda el año ORIGINAL (ver types/events.ts), así que solo se
// tiene en cuenta cuando cae DESPUÉS del día de la ocurrencia; si no, manda
// occurrenceDate, que ya viene proyectado.
export function lastDayOfOccurrence(occurrence: EventOccurrence): string {
  const endDay = occurrence.endDate ? madridIsoDate(occurrence.endDate) : null;
  return endDay && endDay > occurrence.occurrenceDate ? endDay : occurrence.occurrenceDate;
}

// `today` se pasa como argumento (yyyy-MM-dd, ver todayInMadrid) en vez de
// leerlo dentro: así la función es pura y los tests no dependen del reloj.
// Lo de hoy NO es pasado: un evento sigue siendo del día hasta que acaba.
export function isPastOccurrence(occurrence: EventOccurrence, today: string): boolean {
  if (isBirthday(occurrence)) return false;
  return lastDayOfOccurrence(occurrence) < today;
}

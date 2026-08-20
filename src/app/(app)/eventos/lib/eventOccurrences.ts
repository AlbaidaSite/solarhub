import type { EventOccurrence } from "@/types/events";
import { isBirthday } from "@/types/events";
import { madridIsoDate } from "./formatting";

const MAX_VISIBLE_DOTS = 6;

// Agrupa preservando el orden que devuelve el RPC (occurrence_date, hora
// local, id) — ese orden es lo que define cuál es el evento por defecto de
// cada celda.
//
// Un evento de varios días entra en la lista de CADA día que ocupa, no
// solo en la de su fecha de inicio: la misma ocurrencia (el mismo objeto,
// con su occurrenceDate original intacta) aparece bajo varias claves. Se
// reparte aquí y no en el RPC a propósito — occurrenceDate tiene que
// seguir siendo el día en que EMPIEZA la ocurrencia, porque de ahí salen
// la fecha del modal de detalle y el enlace compartible (?fecha=).
//
// Como se recorre en el orden del RPC y se va añadiendo al final de cada
// día, un evento que venía de días atrás queda por delante de los que
// empiezan hoy: es el que la celda muestra por defecto, que es lo
// razonable — ya ocupaba el día antes de que empezara ningún otro.
export function groupOccurrencesByDate(
  occurrences: EventOccurrence[],
): Map<string, EventOccurrence[]> {
  const map = new Map<string, EventOccurrence[]>();
  for (const occurrence of occurrences) {
    for (const day of daysCoveredBy(occurrence)) {
      const list = map.get(day);
      if (list) list.push(occurrence);
      else map.set(day, [occurrence]);
    }
  }
  return map;
}

// Tope de días que se reparten por ocurrencia. La rejilla nunca enseña
// más de 42 celdas, así que este límite no recorta nada visible: está
// para que una end_date con el año mal tecleado (2260 en vez de 2026) no
// se convierta en decenas de miles de vueltas de bucle.
const MAX_OCCURRENCE_DAYS = 366;

// Día siguiente en yyyy-MM-dd. Aritmética en UTC sobre los números de la
// propia cadena (no sobre el instante del evento): es un cálculo de
// calendario, y pasar por la zona horaria del navegador sería justo lo que
// podría desplazar un día en los bordes.
function nextIsoDay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

// Días (yyyy-MM-dd) que ocupa una ocurrencia, del primero al último, ambos
// incluidos. Un evento de un solo día devuelve un único día.
export function daysCoveredBy(occurrence: EventOccurrence): string[] {
  const lastDay = lastDayOfOccurrence(occurrence);
  const days = [occurrence.occurrenceDate];
  let day = occurrence.occurrenceDate;
  while (day < lastDay && days.length < MAX_OCCURRENCE_DAYS) {
    day = nextIsoDay(day);
    days.push(day);
  }
  return days;
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
//
// Con un único evento no hay puntos en absoluto: no queda nada entre lo
// que navegar y la propia celda ya identifica ese evento (su imagen de
// fondo y el color del contorno), así que el punto suelto solo añadía
// ruido. Móvil sí conserva el punto único: allí la celda no muestra
// imagen, el punto es el ÚNICO indicio de que ese día tiene algo.
export function getDesktopDotSequence(dayOccurrences: EventOccurrence[]): DotSequence {
  const events = dayOccurrences.filter((o) => !isBirthday(o));
  if (events.length <= 1) return { visible: [], overflowCount: 0 };
  return buildDotSequence(events);
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

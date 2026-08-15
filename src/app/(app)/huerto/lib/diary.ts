import { MADRID_TZ } from "./madridMonth";
import type { CropDiaryEntry } from "@/types/garden";

// Límites de sow_year. No hay CHECK en BD (la columna es un smallint a
// secas), así que el rango se valida en la acción y en el formulario con
// estas mismas constantes: un año de cuatro cifras razonable para un
// huerto, ni un 12 suelto ni un 20255 por un dedazo.
export const MIN_SOW_YEAR = 1900;
export const MAX_SOW_YEAR = 2100;

// Años con al menos una entrada, del más reciente al más antiguo. Es el
// único recorrido que ofrece la ficha: no se puede navegar hasta un año
// sin diario, ni con las flechas ni con el desplegable.
export function diaryYears(entries: CropDiaryEntry[]): number[] {
  return [...new Set(entries.map((entry) => entry.sow_year))].sort((a, b) => b - a);
}

export function entriesForYear(entries: CropDiaryEntry[], year: number): CropDiaryEntry[] {
  return entries.filter((entry) => entry.sow_year === year);
}

// Avanza `delta` posiciones por la lista de años dando la vuelta en los
// extremos, igual que los meses del panel de cultivos: del más antiguo se
// pasa al más reciente y viceversa. Si el año actual ya no está en la
// lista (se acaba de borrar su última entrada) se vuelve al primero.
export function cycleYear(years: number[], current: number, delta: number): number {
  if (years.length === 0) return current;

  const index = years.indexOf(current);
  if (index === -1) return years[0];

  return years[(index + (delta % years.length) + years.length) % years.length];
}

const diaryDateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  // La ficha solo se monta tras un clic (nunca en SSR), pero se fija la
  // zona igualmente para que la fecha sea la de Madrid y no la del
  // navegador de quien mire.
  timeZone: MADRID_TZ,
});

export function formatDiaryDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : diaryDateFormatter.format(date);
}

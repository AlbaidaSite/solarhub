export interface MonthGridRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// La semana empieza en lunes (convención es-ES, no hardcodeada como número
// mágico: se deriva restando el índice lunes-relativo del día de la
// semana). Devuelve la rejilla VISIBLE de un mes: desde el lunes de la
// semana que contiene el día 1 hasta el domingo de la semana que contiene
// el último día del mes (hasta 42 días; puede cruzar frontera de mes y de
// año, p.ej. diciembre → enero).
//
// Cálculo puramente de calendario (días, no horas), por eso usa UTC en vez
// de la zona horaria del proceso: evita que el propio servidor introduzca
// un desfase de día. La franja horaria real de los eventos (Europe/Madrid)
// se aplica en el RPC `events_in_range`, no aquí.
export function getMonthGridRange(year: number, month: number): MonthGridRange {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const firstWeekdayMondayIndex = (firstOfMonth.getUTCDay() + 6) % 7;
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(gridStart.getUTCDate() - firstWeekdayMondayIndex);

  const lastOfMonth = new Date(Date.UTC(year, month, 0));
  const lastWeekdayMondayIndex = (lastOfMonth.getUTCDay() + 6) % 7;
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - lastWeekdayMondayIndex));

  return { start: toISODate(gridStart), end: toISODate(gridEnd) };
}

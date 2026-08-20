const MADRID_TZ = "Europe/Madrid";

// Partes de un instante ISO en Europe/Madrid, con nombre (no depende del
// orden que dé el locale). "en-CA" es solo el locale interno usado para
// pedirle las partes a Intl — el resultado nunca se muestra tal cual.
function madridParts(iso: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MADRID_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

// Fecha, sola, en dd/MM/yyyy — a partir de `occurrenceDate` (ya viene
// proyectada para eventos anuales), no del año almacenado en
// `eventDateIso`. Se formatea con split, sin pasar por Date/zona
// horaria, para no arriesgar un desfase de día. Se combina con
// formatEventTime (ver más abajo) en vez de devolver un único string
// "fecha hora": así el llamante puede darles tratamiento visual
// separado (tamaño, espaciado) en vez de un espacio suelto.
export function formatEventDateOnly(occurrenceDate: string): string {
  const [year, month, day] = occurrenceDate.split("-");
  return `${day}/${month}/${year}`;
}

// "Hasta": opcional, null si no hay fecha de fin. No hay una
// occurrenceDate aparte para el fin (solo la fecha de inicio se
// reproyecta en eventos anuales), así que aquí sí se deriva todo —
// fecha y hora — directamente de endDateIso en Europe/Madrid.
export function formatEventEndDate(
  endDateIso: string | null,
  endTimeIncluded: boolean,
): string | null {
  if (!endDateIso) return null;
  const { day, month, year, hour, minute } = madridParts(endDateIso);
  const datePart = `${day}/${month}/${year}`;
  return endTimeIncluded ? `${datePart} ${hour}:${minute}` : datePart;
}

// Solo la hora "hh:mm" (Europe/Madrid), o null si no se especificó —
// para filas compactas como las del modal de lista del día.
export function formatEventTime(eventDateIso: string, timeIncluded: boolean): string | null {
  if (!timeIncluded) return null;
  const { hour, minute } = madridParts(eventDateIso);
  return `${hour}:${minute}`;
}

export function formatEventPrice(amount: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(amount);
}

// Día (yyyy-MM-dd) en el que cae un instante ISO visto desde Madrid. Es la
// forma comparable de una fecha: sobre esa cadena, `<` ya ordena bien.
export function madridIsoDate(iso: string): string {
  const { year, month, day } = madridParts(iso);
  return `${year}-${month}-${day}`;
}

// Hoy en Madrid, en el mismo formato. Sale de aquí y no de `new Date()`
// del navegador para que "pasado" signifique lo mismo en el servidor
// (Vercel corre en UTC) que en la pantalla de quien mira.
export function todayInMadrid(): string {
  return madridIsoDate(new Date().toISOString());
}

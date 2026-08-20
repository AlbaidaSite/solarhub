// Fecha y hora de un evento se editan en dos campos sueltos (yyyy-MM-dd y
// hh:mm) y viajan al servidor como un único instante ISO. Componer y
// comparar esos instantes vivía duplicado en los dos formularios —crear y
// editar—, que es como se coló la discrepancia con la validación del
// servidor: el formulario comparaba solo las fechas y el servidor los
// instantes completos, así que un evento que terminaba el mismo día a una
// hora anterior pasaba el filtro del cliente y volvía rechazado desde el
// servidor con el mismo mensaje que el usuario creía haber corregido.

// La hora vacía se interpreta como medianoche, que es el valor neutro que
// guarda el formulario cuando no se especifica hora (ver
// start_time_included / end_time_included en el esquema).
export function combineDateTime(date: string, time: string | null): string {
  return new Date(`${date}T${time || "00:00"}:00`).toISOString();
}

// Mismo criterio que validateEventPayload en eventos/actions.ts: los dos
// lados tienen que decir lo mismo o el aviso parecerá que no se va.
export function isEndBeforeStart(
  startInstantIso: string,
  endInstantIso: string | null,
): boolean {
  if (!endInstantIso) return false;
  return new Date(endInstantIso) < new Date(startInstantIso);
}

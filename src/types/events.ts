export const BIRTHDAY_EVENT_TYPE_CODE = "BIRTHDAY";

export interface EventTypeInfo {
  id: number;
  code: string;
  name: string;
  icon_path: string;
  color: string;
}

// Fila cruda devuelta por el RPC `events_in_range` (columnas planas,
// prefijo `event_type_` para los campos del tipo de evento).
export interface EventOccurrenceRow {
  id: number;
  occurrence_date: string;
  title: string;
  description: string | null;
  place: string | null;
  image_url: string | null;
  url: string | null;
  includes_cromo: boolean;
  // event_date/end_date llegan tal cual están en BD (instante UTC, sin
  // reproyectar): para un evento YEARLY solo dan la HORA real, el
  // año/mes/día proyectado está en occurrence_date. start_time_included/
  // end_time_included dicen si esa hora es real o solo el valor neutro
  // (medianoche) que guarda el formulario cuando no se especificó hora.
  event_date: string;
  end_date: string | null;
  start_time_included: boolean;
  end_time_included: boolean;
  event_type_id: number;
  event_type_code: string;
  event_type_name: string;
  event_type_icon_path: string;
  event_type_color: string;
}

export interface EventOccurrence {
  id: number;
  occurrenceDate: string;
  title: string;
  description: string | null;
  place: string | null;
  imageUrl: string | null;
  url: string | null;
  includesCromo: boolean;
  eventDate: string;
  endDate: string | null;
  startTimeIncluded: boolean;
  endTimeIncluded: boolean;
  eventType: EventTypeInfo;
}

export interface EventPrice {
  id: number;
  reason: string | null;
  price: number;
}

export function toEventOccurrence(row: EventOccurrenceRow): EventOccurrence {
  return {
    id: row.id,
    occurrenceDate: row.occurrence_date,
    title: row.title,
    description: row.description,
    place: row.place,
    imageUrl: row.image_url,
    url: row.url,
    includesCromo: row.includes_cromo,
    eventDate: row.event_date,
    endDate: row.end_date,
    startTimeIncluded: row.start_time_included,
    endTimeIncluded: row.end_time_included,
    eventType: {
      id: row.event_type_id,
      code: row.event_type_code,
      name: row.event_type_name,
      icon_path: row.event_type_icon_path,
      color: row.event_type_color,
    },
  };
}

export function isBirthday(occurrence: EventOccurrence): boolean {
  return occurrence.eventType.code === BIRTHDAY_EVENT_TYPE_CODE;
}

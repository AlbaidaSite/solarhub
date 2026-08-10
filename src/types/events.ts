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
  eventType: EventTypeInfo;
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

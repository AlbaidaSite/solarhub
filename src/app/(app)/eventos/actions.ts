"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStorageUrl } from "@/lib/supabase/storage";
import { toEventOccurrence, type EventOccurrence, type EventOccurrenceRow } from "@/types/events";

// Sin gating por rol: todos los usuarios activos ven todos los eventos
// (política event_select_auth). Se llama tanto desde el Server Component
// de la página (carga inicial) como desde el cliente al navegar de mes.
export async function getEventOccurrencesInRangeAction(
  rangeStart: string,
  rangeEnd: string,
): Promise<EventOccurrence[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("events_in_range", {
    range_start: rangeStart,
    range_end: rangeEnd,
  });

  if (error) {
    // El objeto PostgrestError no siempre serializa bien en el overlay de
    // Next.js (a veces se ve como "{}"); se listan los campos a mano.
    console.error("Error loading events_in_range:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return [];
  }

  const rows = (data ?? []) as EventOccurrenceRow[];

  // `image_url` y `event_type.icon_path` guardan rutas de Storage, no URLs
  // públicas — se resuelven aquí, igual que en mapa/actions.ts.
  return rows.map((row) => {
    const occurrence = toEventOccurrence(row);
    return {
      ...occurrence,
      imageUrl: occurrence.imageUrl ? getStorageUrl(occurrence.imageUrl) : null,
      eventType: {
        ...occurrence.eventType,
        icon_path: getStorageUrl(occurrence.eventType.icon_path),
      },
    };
  });
}

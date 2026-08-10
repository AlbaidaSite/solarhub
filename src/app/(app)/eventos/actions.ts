"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserActionClient } from "@/lib/supabase/actionAuth";
import { getStorageUrl } from "@/lib/supabase/storage";
import {
  toEventOccurrence,
  type EventOccurrence,
  type EventOccurrenceRow,
  type EventPrice,
  type EventTypeInfo,
} from "@/types/events";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

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

// ─── Precios del evento (bajo demanda, modal de detalle) ─────────────────────
// No van en events_in_range (payload de la rejilla): se piden solo cuando
// se abre el modal de detalle de un evento concreto.

export async function getEventPricesAction(eventId: number): Promise<EventPrice[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_price")
    .select("id, reason, price")
    .eq("event_id", eventId)
    .order("id")
    .returns<EventPrice[]>();

  if (error || !data) return [];
  return data;
}

// ─── Tipos de evento (selector del formulario de alta) ───────────────────────

export async function getEventTypesAction(): Promise<EventTypeInfo[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_type")
    .select("id, code, name, icon_path, color")
    .order("name")
    .returns<EventTypeInfo[]>();

  if (error || !data) return [];
  return data.map((row) => ({ ...row, icon_path: getStorageUrl(row.icon_path) }));
}

// ─── Flags de rol del usuario actual (para mostrar casillas restringidas) ────

export async function getCurrentUserRoleFlagsAction(): Promise<{
  isStaff: boolean;
  isLoukou: boolean;
}> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { isStaff: false, isLoukou: false };

  const [staffRes, loukouRes] = await Promise.all([
    supabase.rpc("is_staff"),
    supabase.rpc("is_loukou"),
  ]);

  return { isStaff: Boolean(staffRes.data), isLoukou: Boolean(loukouRes.data) };
}

// ─── Alta de evento ────────────────────────────────────────────────────────

export type EventActionResult = { ok: true } | { ok: false; error: string };

export interface CreateEventPrice {
  reason: string | null;
  price: number;
}

export interface CreateEventData {
  title: string;
  place: string | null;
  eventTypeId: number;
  // Instantes ya combinados (fecha + hora, o medianoche si no hay hora) por
  // el cliente, en ISO — mismo criterio que CreatePinData.created_at en
  // mapa/actions.ts.
  eventDate: string;
  startTimeIncluded: boolean;
  endDate: string | null;
  endTimeIncluded: boolean;
  description: string | null;
  url: string | null;
  recurrence: "NONE" | "YEARLY";
  includesCromo: boolean;
  hideExternal: boolean;
  prices: CreateEventPrice[];
}

export type CreateEventResult = { ok: true; eventId: number } | { ok: false; error: string };

function validateEventPayload(data: CreateEventData): string | null {
  const errors: string[] = [];
  if (!data.title.trim()) errors.push("El título es obligatorio.");
  if (!data.place || !data.place.trim()) errors.push("El lugar es obligatorio.");
  if (!data.eventTypeId) errors.push("Selecciona un tipo de evento.");
  if (!data.eventDate) errors.push("La fecha de inicio es obligatoria.");
  if (data.endDate && new Date(data.endDate) < new Date(data.eventDate)) {
    errors.push("La fecha de fin no puede ser anterior a la de inicio.");
  }
  for (const p of data.prices) {
    if (!Number.isFinite(p.price) || p.price < 0) errors.push("Hay un precio no válido.");
  }
  return errors.length > 0 ? errors.join("\n") : null;
}

export async function createEventAction(data: CreateEventData): Promise<CreateEventResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const validationError = validateEventPayload(data);
  if (validationError) return { ok: false, error: validationError };

  const { data: inserted, error: insertError } = await supabase
    .from("event")
    .insert({
      user_id: userId,
      event_type_id: data.eventTypeId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      event_date: data.eventDate,
      end_date: data.endDate,
      start_time_included: data.startTimeIncluded,
      end_time_included: data.endTimeIncluded,
      place: data.place?.trim() || null,
      url: data.url?.trim() || null,
      recurrence: data.recurrence,
      includes_cromo: data.includesCromo,
      hide_external: data.hideExternal,
    })
    .select("id")
    .single<{ id: number }>();

  if (insertError || !inserted) {
    return { ok: false, error: insertError?.message ?? "Error al guardar" };
  }

  const eventId = inserted.id;

  const pricesToInsert = data.prices.filter((p) => Number.isFinite(p.price));
  if (pricesToInsert.length > 0) {
    const { error: priceError } = await supabase.from("event_price").insert(
      pricesToInsert.map((p) => ({
        event_id: eventId,
        reason: p.reason?.trim() || null,
        price: p.price,
      })),
    );
    if (priceError) return { ok: false, error: priceError.message };
  }

  return { ok: true, eventId };
}

// ─── Fotos del evento ────────────────────────────────────────────────────────
// La 1ª foto sube a event.image_url (portada, ya consumida por
// events_in_range/EventImageLayer); el resto (máx. 2 más) va a event_photo.

async function canEditEvent(
  supabase: ServerClient,
  eventId: number,
  userId: string,
): Promise<boolean> {
  const { data: event } = await supabase
    .from("event")
    .select("user_id")
    .eq("id", eventId)
    .maybeSingle<{ user_id: string }>();

  if (!event) return false;
  if (event.user_id === userId) return true;

  const { data: isStaff } = await supabase.rpc("is_staff");
  return Boolean(isStaff);
}

export async function addEventPhotosAction(
  eventId: number,
  paths: string[],
): Promise<EventActionResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const allowed = await canEditEvent(supabase, eventId, userId);
  if (!allowed) return { ok: false, error: "Evento no encontrado o sin permiso." };

  if (paths.length === 0) return { ok: true };

  const [coverPath, ...extraPaths] = paths;

  const { error: updateError } = await supabase
    .from("event")
    .update({ image_url: coverPath })
    .eq("id", eventId);
  if (updateError) return { ok: false, error: updateError.message };

  if (extraPaths.length > 0) {
    const { error: insertError } = await supabase
      .from("event_photo")
      .insert(extraPaths.map((path) => ({ event_id: eventId, path })));
    if (insertError) return { ok: false, error: insertError.message };
  }

  return { ok: true };
}

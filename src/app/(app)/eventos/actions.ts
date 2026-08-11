"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserActionClient } from "@/lib/supabase/actionAuth";
import { getStorageUrl, STORAGE_BUCKET } from "@/lib/supabase/storage";
import {
  toEventOccurrence,
  type EventOccurrence,
  type EventOccurrenceRow,
  type EventPrice,
  type EventTypeInfo,
} from "@/types/events";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// `image_url` y `event_type.icon_path` guardan rutas de Storage, no URLs
// públicas — se resuelven aquí, igual que en mapa/actions.ts. Compartido
// por todo lo que lee filas de events_in_range (rejilla del calendario y
// el listado de "eventos pendientes" del perfil).
function resolveOccurrenceRow(row: EventOccurrenceRow): EventOccurrence {
  const occurrence = toEventOccurrence(row);
  return {
    ...occurrence,
    imageUrl: occurrence.imageUrl ? getStorageUrl(occurrence.imageUrl) : null,
    eventType: {
      ...occurrence.eventType,
      icon_path: getStorageUrl(occurrence.eventType.icon_path),
    },
  };
}

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
  return rows.map(resolveOccurrenceRow);
}

// ─── Eventos marcados con interés, próximos (perfil) ─────────────────────────
// Reutiliza events_in_range en vez de una consulta aparte: la expansión de
// recurrencia anual (un cumpleaños YEARLY, p.ej.) ya vive ahí y no
// conviene duplicarla. El rango va de "hoy" (Europe/Madrid) a +400 días —
// suficiente para que cualquier evento YEARLY marcado aparezca por su
// próxima ocurrencia sin importar en qué punto del año esté ahora mismo.

function todayInMadrid(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function addDaysToIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// Tope de eventos "próximos" mostrados a la vez en el perfil — con muchos
// eventos marcados, la lista debe scrollear dentro de su propio panel en
// vez de crecer sin límite (ver UpcomingEventsList.tsx).
const MAX_UPCOMING_LIKED_EVENTS = 20;

export async function getUpcomingLikedEventsAction(): Promise<EventOccurrence[]> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return [];
  const { supabase } = auth;

  const rangeStart = todayInMadrid();
  const rangeEnd = addDaysToIsoDate(rangeStart, 400);

  const { data, error } = await supabase.rpc("events_in_range", {
    range_start: rangeStart,
    range_end: rangeEnd,
  });

  if (error) {
    console.error("Error loading upcoming liked events:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return [];
  }

  const rows = (data ?? []) as EventOccurrenceRow[];

  // Una ventana de 400 días es más ancha que un año: un evento YEARLY
  // cuya fecha caiga dentro de los primeros ~35 días desde "hoy" proyecta
  // AMBAS ocurrencias (la de este año y la del año que viene) dentro del
  // rango, mismo id de evento en dos filas. Aquí solo interesa "la
  // próxima vez que toca" — nos quedamos con la primera aparición de cada
  // id (events_in_range ya ordena por occurrence_date ascendente, así que
  // la primera es la más próxima) y se descarta el resto.
  const seenEventIds = new Set<number>();
  const nextOccurrencePerEvent: EventOccurrenceRow[] = [];
  for (const row of rows) {
    if (!row.liked || seenEventIds.has(row.id)) continue;
    seenEventIds.add(row.id);
    nextOccurrencePerEvent.push(row);
    if (nextOccurrencePerEvent.length >= MAX_UPCOMING_LIKED_EVENTS) break;
  }

  return nextOccurrencePerEvent.map(resolveOccurrenceRow);
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

// ─── Fotos extra del evento (bajo demanda, carrusel del modal de detalle) ────
// La portada ya viaja resuelta en EventOccurrence.imageUrl (events_in_range);
// esto trae solo las fotos adicionales (event_photo), igual criterio que
// getEventPricesAction: nada de esto va en el payload de la rejilla.

export async function getEventExtraPhotosAction(eventId: number): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_photo")
    .select("path")
    .eq("event_id", eventId)
    .order("id")
    .returns<Array<{ path: string }>>();

  if (error || !data) return [];
  return data.map((row) => getStorageUrl(row.path));
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

// ─── Auth: ¿puede el usuario actual editar/borrar este evento? ──────────────
// Se distingue dueño de staff (no solo un booleano combinado) porque la UI
// necesita saberlo: un staff editando/borrando el evento de otro usuario
// muestra los botones en rojo para evitar confusiones (ver EventDetailModal).

export interface EventEditPermission {
  isOwner: boolean;
  isStaff: boolean;
}

async function getEventEditPermission(
  supabase: ServerClient,
  eventId: number,
  userId: string,
): Promise<EventEditPermission> {
  const { data: event } = await supabase
    .from("event")
    .select("user_id")
    .eq("id", eventId)
    .maybeSingle<{ user_id: string }>();

  if (!event) return { isOwner: false, isStaff: false };

  const { data: isStaffData } = await supabase.rpc("is_staff");
  return { isOwner: event.user_id === userId, isStaff: Boolean(isStaffData) };
}

async function canEditEvent(
  supabase: ServerClient,
  eventId: number,
  userId: string,
): Promise<boolean> {
  const { isOwner, isStaff } = await getEventEditPermission(supabase, eventId, userId);
  return isOwner || isStaff;
}

export async function checkEventEditPermissionAction(
  eventId: number,
): Promise<EventEditPermission> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return { isOwner: false, isStaff: false };
  return getEventEditPermission(auth.supabase, eventId, auth.userId);
}

// ─── Fotos del evento ────────────────────────────────────────────────────────
// La 1ª foto sube a event.image_url (portada, ya consumida por
// events_in_range/EventImageLayer); el resto (máx. 2 más) va a event_photo.
// Solo se asigna portada si el evento todavía no tiene una — en alta
// siempre es así (evento recién insertado), y en edición evita
// sobrescribir la portada existente cuando el usuario solo añade fotos
// extra.

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

  const { data: current } = await supabase
    .from("event")
    .select("image_url")
    .eq("id", eventId)
    .maybeSingle<{ image_url: string | null }>();

  let extraPaths = paths;
  if (!current?.image_url) {
    const [coverPath, ...rest] = paths;
    const { error: updateError } = await supabase
      .from("event")
      .update({ image_url: coverPath })
      .eq("id", eventId);
    if (updateError) return { ok: false, error: updateError.message };
    extraPaths = rest;
  }

  if (extraPaths.length > 0) {
    const { error: insertError } = await supabase
      .from("event_photo")
      .insert(extraPaths.map((path) => ({ event_id: eventId, path })));
    if (insertError) return { ok: false, error: insertError.message };
  }

  return { ok: true };
}

export async function deleteEventPhotoAction(
  photoId: number,
  eventId: number,
): Promise<EventActionResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const allowed = await canEditEvent(supabase, eventId, userId);
  if (!allowed) return { ok: false, error: "Sin permiso." };

  const { data: photo } = await supabase
    .from("event_photo")
    .select("path")
    .eq("id", photoId)
    .eq("event_id", eventId)
    .maybeSingle<{ path: string }>();

  if (!photo) return { ok: false, error: "Foto no encontrada." };

  await supabase.storage.from(STORAGE_BUCKET).remove([photo.path]);

  const { error } = await supabase.from("event_photo").delete().eq("id", photoId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Edición de evento ───────────────────────────────────────────────────────

export interface EventPhoto {
  id: number;
  path: string;
  url: string;
}

export interface EventEditDetail {
  id: number;
  title: string;
  place: string | null;
  eventTypeId: number;
  eventDate: string;
  startTimeIncluded: boolean;
  endDate: string | null;
  endTimeIncluded: boolean;
  description: string | null;
  url: string | null;
  recurrence: "NONE" | "YEARLY";
  includesCromo: boolean;
  hideExternal: boolean;
  imageUrl: string | null;
  prices: EventPrice[];
  photos: EventPhoto[];
}

interface EventEditRow {
  id: number;
  title: string;
  place: string | null;
  event_type_id: number;
  event_date: string;
  start_time_included: boolean;
  end_date: string | null;
  end_time_included: boolean;
  description: string | null;
  url: string | null;
  recurrence: "NONE" | "YEARLY";
  includes_cromo: boolean;
  hide_external: boolean;
  image_url: string | null;
}

export async function getEventForEditAction(eventId: number): Promise<EventEditDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data: event, error } = await supabase
    .from("event")
    .select(
      "id, title, place, event_type_id, event_date, start_time_included, end_date, end_time_included, description, url, recurrence, includes_cromo, hide_external, image_url",
    )
    .eq("id", eventId)
    .maybeSingle<EventEditRow>();

  if (error || !event) return null;

  const [pricesRes, photosRes] = await Promise.all([
    supabase
      .from("event_price")
      .select("id, reason, price")
      .eq("event_id", eventId)
      .order("id")
      .returns<EventPrice[]>(),
    supabase
      .from("event_photo")
      .select("id, path")
      .eq("event_id", eventId)
      .order("id")
      .returns<Array<{ id: number; path: string }>>(),
  ]);

  return {
    id: event.id,
    title: event.title,
    place: event.place,
    eventTypeId: event.event_type_id,
    eventDate: event.event_date,
    startTimeIncluded: event.start_time_included,
    endDate: event.end_date,
    endTimeIncluded: event.end_time_included,
    description: event.description,
    url: event.url,
    recurrence: event.recurrence,
    includesCromo: event.includes_cromo,
    hideExternal: event.hide_external,
    imageUrl: event.image_url ? getStorageUrl(event.image_url) : null,
    prices: pricesRes.data ?? [],
    photos: (photosRes.data ?? []).map((p) => ({ id: p.id, path: p.path, url: getStorageUrl(p.path) })),
  };
}

export type UpdateEventData = CreateEventData;

export async function updateEventAction(
  eventId: number,
  data: UpdateEventData,
): Promise<EventActionResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const allowed = await canEditEvent(supabase, eventId, userId);
  if (!allowed) return { ok: false, error: "Sin permiso para editar este evento." };

  const validationError = validateEventPayload(data);
  if (validationError) return { ok: false, error: validationError };

  const { error: updateError } = await supabase
    .from("event")
    .update({
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
    .eq("id", eventId);

  if (updateError) return { ok: false, error: updateError.message };

  // Reemplaza los precios en bloque (borra + inserta) en vez de diffear
  // filas: más simple y evita arrastrar ids de precios ya eliminados en
  // el formulario.
  const { error: deletePricesError } = await supabase
    .from("event_price")
    .delete()
    .eq("event_id", eventId);
  if (deletePricesError) return { ok: false, error: deletePricesError.message };

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

  return { ok: true };
}

export async function deleteEventAction(eventId: number): Promise<EventActionResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const allowed = await canEditEvent(supabase, eventId, userId);
  if (!allowed) return { ok: false, error: "Sin permiso para eliminar este evento." };

  // Recolectamos las rutas de storage (portada + fotos extra) antes de
  // borrar las filas — event_price/event_photo caen solos por
  // "on delete cascade", pero los objetos de storage no.
  const [eventRes, photosRes] = await Promise.all([
    supabase.from("event").select("image_url").eq("id", eventId).maybeSingle<{ image_url: string | null }>(),
    supabase.from("event_photo").select("path").eq("event_id", eventId).returns<Array<{ path: string }>>(),
  ]);

  const storagePaths = [
    ...(eventRes.data?.image_url ? [eventRes.data.image_url] : []),
    ...(photosRes.data ?? []).map((p) => p.path),
  ];

  if (storagePaths.length > 0) {
    await supabase.storage.from(STORAGE_BUCKET).remove(storagePaths);
  }

  const { error } = await supabase.from("event").delete().eq("id", eventId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Interés ("mostrar interés") ─────────────────────────────────────────────
// Alterna la fila en liked_event para el usuario actual — sin permisos de
// dueño/staff, cualquier autenticado puede marcar interés en cualquier
// evento (política liked_event_write_self, ver
// 20260810140000_drop_attending_add_liked_event.sql).

export type ToggleInterestResult = { ok: true; liked: boolean } | { ok: false; error: string };

export async function toggleEventInterestAction(eventId: number): Promise<ToggleInterestResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase, userId } = auth;

  const { data: existing, error: selectError } = await supabase
    .from("liked_event")
    .select("id")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .maybeSingle<{ id: number }>();

  if (selectError) return { ok: false, error: selectError.message };

  if (existing) {
    const { error: deleteError } = await supabase.from("liked_event").delete().eq("id", existing.id);
    if (deleteError) return { ok: false, error: deleteError.message };
    return { ok: true, liked: false };
  }

  const { error: insertError } = await supabase
    .from("liked_event")
    .insert({ user_id: userId, event_id: eventId });
  if (insertError) return { ok: false, error: insertError.message };
  return { ok: true, liked: true };
}

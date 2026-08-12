"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserActionClient } from "@/lib/supabase/actionAuth";
import { getStorageUrl } from "@/lib/supabase/storage";
import { canAddCrop } from "./lib/subcells";
import type { GardenBed, Plant, PlantBed } from "@/types/garden";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const PLANT_BED_COLUMNS = "id, plant_id, garden_bed_id, description, is_future, order_number";

function normalizeMonths(months: number[] | null): number[] | null {
  if (months == null) return null;
  return months.map(Number);
}

export interface GardenData {
  plants: Plant[];
  beds: GardenBed[];
  plantBeds: PlantBed[];
}

// Las tres tablas son diminutas (decenas de filas): se cargan enteras
// una sola vez aquí y todo el filtrado por mes / modo se hace en
// cliente, para que navegar entre meses o entre Actual/Planificar no
// genere ninguna petición de red.
export async function getGardenDataAction(): Promise<GardenData> {
  const supabase = await createSupabaseServerClient();

  const [plantsRes, bedsRes, plantBedsRes] = await Promise.all([
    supabase
      .from("plant")
      .select("id, name, icon_path, seed_info, harvest_info, months_of_growth, months_of_harvest, color")
      .order("name")
      .returns<Plant[]>(),
    supabase
      .from("garden_bed")
      .select("id, name, width, height, pos_x, pos_y")
      .order("id")
      .returns<GardenBed[]>(),
    supabase
      .from("plant_bed")
      .select(PLANT_BED_COLUMNS)
      .order("id")
      .returns<PlantBed[]>(),
  ]);

  // Next.js reenvía console.error de Server Components al navegador
  // serializando el objeto; un PostgrestError pasado tal cual acaba
  // mostrando "{}" ahí aunque en el terminal del servidor sí se vea
  // completo. Se loguean los campos explícitos para que el mensaje sea
  // legible en ambos sitios.
  if (plantsRes.error) {
    const e = plantsRes.error;
    console.error(`Error loading plant: ${e.message} (code=${e.code}, details=${e.details}, hint=${e.hint})`);
  }
  if (bedsRes.error) {
    const e = bedsRes.error;
    console.error(`Error loading garden_bed: ${e.message} (code=${e.code}, details=${e.details}, hint=${e.hint})`);
  }
  if (plantBedsRes.error) {
    const e = plantBedsRes.error;
    console.error(`Error loading plant_bed: ${e.message} (code=${e.code}, details=${e.details}, hint=${e.hint})`);
  }

  const plants = (plantsRes.data ?? []).map((p) => ({
    ...p,
    icon_path: getStorageUrl(p.icon_path),
    // PostgREST puede devolver smallint[] con elementos ya numéricos,
    // pero se normaliza aquí (frontera con el exterior) para que
    // monthGroups pueda comparar con Array.includes(m) sin que un
    // desajuste string/number ("1" !== 1) mande todo a "Otros".
    months_of_growth: normalizeMonths(p.months_of_growth),
    months_of_harvest: normalizeMonths(p.months_of_harvest),
  }));

  return {
    plants,
    beds: bedsRes.data ?? [],
    plantBeds: plantBedsRes.data ?? [],
  };
}

// ─── Permiso de edición del huerto ──────────────────────────────────────────
// Garden manager o staff (ver la política plant_bed_write_garden_manager,
// ampliada en 20260812170100_plant_bed_write_staff.sql). Es lo que decide si
// los bancales son clicables y si los iconos del panel se pueden arrastrar;
// quien no lo tenga sigue viendo el huerto entero, solo que de lectura.

export async function getGardenPermissionAction(): Promise<{ canManage: boolean }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { canManage: false };

  const [managerRes, staffRes] = await Promise.all([
    supabase.rpc("is_garden_manager"),
    supabase.rpc("is_staff"),
  ]);

  return { canManage: Boolean(managerRes.data) || Boolean(staffRes.data) };
}

// ─── Edición de los cultivos de un bancal ───────────────────────────────────
// Todas las mutaciones devuelven la lista COMPLETA de cultivos del bancal en
// ese modo, ya reordenada: el cliente sustituye ese bloque en su estado en vez
// de intentar replicar a mano el renumerado. Son como mucho un puñado de filas
// (la regla de MIN_SUBCELL_SIZE lo limita), así que sale más barato que
// arriesgarse a que el orden del cliente se desvíe del de la base de datos.

export type PlantBedResult =
  | { ok: true; rows: PlantBed[] }
  | { ok: false; error: string };

export interface AddPlantBedInput {
  gardenBedId: number;
  plantId: number;
  description: string | null;
  isFuture: boolean;
  // Posición donde insertarlo (0 = primero). Se recorta al tamaño real de
  // la lista: al soltar un icono el índice viene de la geometría, y entre
  // el arrastre y el guardado el bancal puede haber cambiado.
  index: number;
}

export async function addPlantBedAction(input: AddPlantBedInput): Promise<PlantBedResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  if (!(await canManageGarden(supabase))) {
    return { ok: false, error: "No tienes permiso para editar el huerto." };
  }

  const { data: bed } = await supabase
    .from("garden_bed")
    .select("id, name, width, height, pos_x, pos_y")
    .eq("id", input.gardenBedId)
    .maybeSingle<GardenBed>();
  if (!bed) return { ok: false, error: "Bancal no encontrado." };

  const rows = await fetchBedRows(supabase, input.gardenBedId, input.isFuture);

  // La misma regla que desactiva el botón en el cliente, revalidada aquí:
  // el modal puede llevar abierto un rato y el bancal haberse llenado desde
  // otra sesión.
  if (!canAddCrop(bed, rows.length)) {
    return {
      ok: false,
      error: "No cabe otro cultivo en este bancal: las divisiones quedarían demasiado pequeñas.",
    };
  }

  const index = clampIndex(input.index, rows.length);

  const { data: inserted, error } = await supabase
    .from("plant_bed")
    .insert({
      garden_bed_id: input.gardenBedId,
      plant_id: input.plantId,
      description: normalizeDescription(input.description),
      is_future: input.isFuture,
      order_number: index,
    })
    .select(PLANT_BED_COLUMNS)
    .single<PlantBed>();

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "No se pudo añadir el cultivo." };
  }

  const ordered = [...rows];
  ordered.splice(index, 0, inserted);
  return finishWithOrder(supabase, input.gardenBedId, input.isFuture, ordered);
}

export interface UpdatePlantBedInput {
  id: number;
  plantId: number;
  description: string | null;
}

export async function updatePlantBedAction(input: UpdatePlantBedInput): Promise<PlantBedResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  if (!(await canManageGarden(supabase))) {
    return { ok: false, error: "No tienes permiso para editar el huerto." };
  }

  // El bancal y el modo no se tocan al editar (para eso está arrastrar):
  // se leen de la fila para saber qué bloque devolver.
  const { data: updated, error } = await supabase
    .from("plant_bed")
    .update({
      plant_id: input.plantId,
      description: normalizeDescription(input.description),
    })
    .eq("id", input.id)
    .select(PLANT_BED_COLUMNS)
    .maybeSingle<PlantBed>();

  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: false, error: "Cultivo no encontrado." };

  return {
    ok: true,
    rows: await fetchBedRows(supabase, updated.garden_bed_id, updated.is_future),
  };
}

export async function deletePlantBedAction(id: number): Promise<PlantBedResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  if (!(await canManageGarden(supabase))) {
    return { ok: false, error: "No tienes permiso para editar el huerto." };
  }

  // Se lee antes de borrar: después ya no hay forma de saber a qué bancal
  // y modo pertenecía para devolver la lista renumerada.
  const { data: row } = await supabase
    .from("plant_bed")
    .select(PLANT_BED_COLUMNS)
    .eq("id", id)
    .maybeSingle<PlantBed>();
  if (!row) return { ok: false, error: "Cultivo no encontrado." };

  const { error } = await supabase.from("plant_bed").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  const remaining = await fetchBedRows(supabase, row.garden_bed_id, row.is_future);
  return finishWithOrder(supabase, row.garden_bed_id, row.is_future, remaining);
}

export interface ReorderPlantBedsInput {
  gardenBedId: number;
  isFuture: boolean;
  // Ids en su nuevo orden. Debe contener exactamente los cultivos que ese
  // bancal tiene en ese modo.
  orderedIds: number[];
}

export async function reorderPlantBedsAction(
  input: ReorderPlantBedsInput,
): Promise<PlantBedResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  if (!(await canManageGarden(supabase))) {
    return { ok: false, error: "No tienes permiso para editar el huerto." };
  }

  const rows = await fetchBedRows(supabase, input.gardenBedId, input.isFuture);
  const byId = new Map(rows.map((row) => [row.id, row]));

  // El cliente manda ids sobre la foto que tenía en pantalla. Si no
  // coinciden con las filas reales (alguien borró un cultivo mientras
  // tanto), se rechaza en vez de escribir un orden a medias.
  const ordered = input.orderedIds.map((id) => byId.get(id));
  if (ordered.length !== rows.length || ordered.some((row) => row === undefined)) {
    return { ok: false, error: "El bancal ha cambiado; vuelve a abrirlo." };
  }

  return finishWithOrder(supabase, input.gardenBedId, input.isFuture, ordered as PlantBed[]);
}

// ─── Apoyo ──────────────────────────────────────────────────────────────────

async function canManageGarden(supabase: ServerClient): Promise<boolean> {
  const [managerRes, staffRes] = await Promise.all([
    supabase.rpc("is_garden_manager"),
    supabase.rpc("is_staff"),
  ]);
  return Boolean(managerRes.data) || Boolean(staffRes.data);
}

async function fetchBedRows(
  supabase: ServerClient,
  gardenBedId: number,
  isFuture: boolean,
): Promise<PlantBed[]> {
  const { data } = await supabase
    .from("plant_bed")
    .select(PLANT_BED_COLUMNS)
    .eq("garden_bed_id", gardenBedId)
    .eq("is_future", isFuture)
    .order("order_number")
    .order("id")
    .returns<PlantBed[]>();
  return data ?? [];
}

// Reescribe order_number como 0..n-1 sobre el orden recibido y devuelve la
// lista ya coherente. Solo se escriben las filas cuyo número cambia: un
// bancal típico tiene 2 o 3 cultivos y reordenar suele mover uno solo.
async function finishWithOrder(
  supabase: ServerClient,
  gardenBedId: number,
  isFuture: boolean,
  ordered: PlantBed[],
): Promise<PlantBedResult> {
  const changed = ordered
    .map((row, position) => ({ id: row.id, position, current: row.order_number }))
    .filter((entry) => entry.current !== entry.position);

  const results = await Promise.all(
    changed.map((entry) =>
      supabase
        .from("plant_bed")
        .update({ order_number: entry.position })
        .eq("id", entry.id),
    ),
  );

  const failure = results.find((result) => result.error);
  if (failure?.error) return { ok: false, error: failure.error.message };

  return { ok: true, rows: await fetchBedRows(supabase, gardenBedId, isFuture) };
}

function clampIndex(index: number, length: number): number {
  if (!Number.isFinite(index)) return length;
  return Math.min(Math.max(Math.trunc(index), 0), length);
}

// Un "tipo" en blanco es no tener tipo: se guarda null y no una cadena
// vacía, para que la fila del listado no reserve sitio para nada.
function normalizeDescription(description: string | null): string | null {
  const trimmed = description?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

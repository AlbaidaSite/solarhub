"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserActionClient } from "@/lib/supabase/actionAuth";
import { getStorageUrl } from "@/lib/supabase/storage";
import { canAddCrop } from "./lib/subcells";
import { MAX_SOW_YEAR, MIN_SOW_YEAR } from "./lib/diary";
import type { CropDiaryEntry, GardenBed, Plant, PlantBed } from "@/types/garden";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const PLANT_COLUMNS =
  "id, name, icon_path, seed_info, harvest_info, months_of_growth, months_of_harvest, color";
const PLANT_BED_COLUMNS = "id, plant_id, garden_bed_id, description, is_future, order_number";
const CROP_DIARY_COLUMNS = "id, plant_id, sow_year, notes, updated_at";

function normalizeMonths(months: number[] | null): number[] | null {
  if (months == null) return null;
  return months.map(Number);
}

// Deja una fila de plant lista para el cliente: icono resuelto a URL
// pública y meses ya numéricos. Lo aplican por igual la carga inicial y
// la edición de la ficha, para que una planta editada no vuelva con el
// icon_path crudo y la imagen deje de cargar.
function toClientPlant(plant: Plant): Plant {
  return {
    ...plant,
    icon_path: getStorageUrl(plant.icon_path),
    // PostgREST puede devolver smallint[] con elementos ya numéricos,
    // pero se normaliza aquí (frontera con el exterior) para que
    // monthGroups pueda comparar con Array.includes(m) sin que un
    // desajuste string/number ("1" !== 1) mande todo a "Otros".
    months_of_growth: normalizeMonths(plant.months_of_growth),
    months_of_harvest: normalizeMonths(plant.months_of_harvest),
  };
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
      .select(PLANT_COLUMNS)
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

  const plants = (plantsRes.data ?? []).map(toClientPlant);

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
      description: nullIfBlank(input.description),
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
      description: nullIfBlank(input.description),
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

export interface ClearBedCropsInput {
  gardenBedId: number;
  isFuture: boolean;
}

// Vacía de una vez el bancal en el modo que se está viendo, que es el único
// que enseña el modal: quien mira los cultivos actuales no espera perder de
// paso lo que tenía planificado (ni al revés).
export async function clearBedCropsAction(
  input: ClearBedCropsInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  if (!(await canManageGarden(supabase))) {
    return { ok: false, error: "No tienes permiso para editar el huerto." };
  }

  const { error } = await supabase
    .from("plant_bed")
    .delete()
    .eq("garden_bed_id", input.gardenBedId)
    .eq("is_future", input.isFuture);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
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

// ─── Ficha de cultivo: siembra y recolecta ──────────────────────────────────
// Las dos mitades de la ficha (seed_info + months_of_growth, harvest_info +
// months_of_harvest) se editan por separado y comparten acción: es el mismo
// par "texto + meses" y solo cambia la pareja de columnas que toca.

export type PlantSection = "siembra" | "recolecta";

export interface UpdatePlantSectionInput {
  plantId: number;
  section: PlantSection;
  info: string | null;
  // Meses (1-12) en los que se siembra o se recolecta. Lista vacía =
  // sin meses declarados; se guarda '{}' y no null (son equivalentes
  // para la vista, ver monthGroups).
  months: number[];
}

export type PlantResult = { ok: true; plant: Plant } | { ok: false; error: string };

export async function updatePlantSectionAction(
  input: UpdatePlantSectionInput,
): Promise<PlantResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  if (!(await canManageGarden(supabase))) {
    return { ok: false, error: "No tienes permiso para editar el huerto." };
  }

  const months = normalizeMonthSelection(input.months);
  if (months === null) {
    return { ok: false, error: "Los meses deben ir de 1 (enero) a 12 (diciembre)." };
  }

  const info = nullIfBlank(input.info);
  const patch =
    input.section === "siembra"
      ? { seed_info: info, months_of_growth: months }
      : { harvest_info: info, months_of_harvest: months };

  const { data, error } = await supabase
    .from("plant")
    .update(patch)
    .eq("id", input.plantId)
    .select(PLANT_COLUMNS)
    .maybeSingle<Plant>();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Cultivo no encontrado." };

  return { ok: true, plant: toClientPlant(data) };
}

// ─── Ficha de cultivo: diario ───────────────────────────────────────────────
// Igual que los cultivos de un bancal, las mutaciones devuelven el diario
// COMPLETO de la planta ya ordenado: son unas pocas filas y así el cliente no
// tiene que recolocar la entrada nueva en su sitio.

export type CropDiaryResult =
  | { ok: true; entries: CropDiaryEntry[] }
  | { ok: false; error: string };

// El diario no viaja con el resto de datos del huerto (getGardenDataAction):
// solo hace falta al abrir la ficha de un cultivo concreto, y cargarlo entero
// para todas las plantas sería traer datos que casi nadie mira.
export async function getCropDiaryAction(plantId: number): Promise<CropDiaryEntry[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("crop_diary")
    .select(CROP_DIARY_COLUMNS)
    .eq("plant_id", plantId)
    .order("sow_year", { ascending: false })
    .order("id")
    .returns<CropDiaryEntry[]>();

  if (error) {
    console.error(
      `Error loading crop_diary: ${error.message} (code=${error.code}, details=${error.details}, hint=${error.hint})`,
    );
  }

  return data ?? [];
}

export interface AddCropDiaryEntryInput {
  plantId: number;
  sowYear: number;
  notes: string;
}

export async function addCropDiaryEntryAction(
  input: AddCropDiaryEntryInput,
): Promise<CropDiaryResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  if (!(await canManageGarden(supabase))) {
    return { ok: false, error: "No tienes permiso para editar el huerto." };
  }

  const invalid = validateDiaryEntry(input.sowYear, input.notes);
  if (invalid) return { ok: false, error: invalid };

  const { error } = await supabase.from("crop_diary").insert({
    plant_id: input.plantId,
    sow_year: input.sowYear,
    notes: input.notes.trim(),
  });

  if (error) return { ok: false, error: error.message };

  return { ok: true, entries: await getCropDiaryAction(input.plantId) };
}

export interface UpdateCropDiaryEntryInput {
  id: number;
  sowYear: number;
  notes: string;
}

export async function updateCropDiaryEntryAction(
  input: UpdateCropDiaryEntryInput,
): Promise<CropDiaryResult> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  if (!(await canManageGarden(supabase))) {
    return { ok: false, error: "No tienes permiso para editar el huerto." };
  }

  const invalid = validateDiaryEntry(input.sowYear, input.notes);
  if (invalid) return { ok: false, error: invalid };

  const { data, error } = await supabase
    .from("crop_diary")
    .update({ sow_year: input.sowYear, notes: input.notes.trim() })
    .eq("id", input.id)
    .select("plant_id")
    .maybeSingle<{ plant_id: number }>();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Entrada del diario no encontrada." };

  return { ok: true, entries: await getCropDiaryAction(data.plant_id) };
}

// Devuelve solo ok/error (no el diario resultante): quien borra ya sabe qué
// entrada se ha ido y la quita de su lista, igual que hace el modal de bancal
// con un cultivo eliminado.
export async function deleteCropDiaryEntryAction(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUserActionClient();
  if (!auth.ok) return auth;
  const { supabase } = auth;

  if (!(await canManageGarden(supabase))) {
    return { ok: false, error: "No tienes permiso para editar el huerto." };
  }

  const { error } = await supabase.from("crop_diary").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
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

// Un texto opcional en blanco es no tener texto: se guarda null y no una
// cadena vacía, para que quien lo pinte (el "tipo" bajo el nombre de un
// cultivo, la información de siembra…) no reserve sitio para nada.
function nullIfBlank(text: string | null): string | null {
  const trimmed = text?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

// Ordena y quita repetidos, y devuelve null si algún valor no es un mes
// (1-12). Lo segundo lo rechazaría igual el CHECK de plant_months_*_range,
// pero como un error de Postgres sin traducir; aquí se convierte en un
// mensaje que el formulario puede enseñar tal cual.
function normalizeMonthSelection(months: number[]): number[] | null {
  const unique = [...new Set(months.map(Number))];
  if (unique.some((m) => !Number.isInteger(m) || m < 1 || m > 12)) return null;
  return unique.sort((a, b) => a - b);
}

// Una entrada sin texto no es una entrada: la columna admite null, pero el
// diario se lee entrada a entrada y una vacía solo ocuparía sitio.
function validateDiaryEntry(sowYear: number, notes: string): string | null {
  if (!Number.isInteger(sowYear) || sowYear < MIN_SOW_YEAR || sowYear > MAX_SOW_YEAR) {
    return `El año debe estar entre ${MIN_SOW_YEAR} y ${MAX_SOW_YEAR}.`;
  }
  if (notes.trim() === "") return "Escribe algo en la entrada del diario.";
  return null;
}

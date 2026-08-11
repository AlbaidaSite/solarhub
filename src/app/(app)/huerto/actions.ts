"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStorageUrl } from "@/lib/supabase/storage";
import type { GardenBed, Plant, PlantBed } from "@/types/garden";

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
      .select("id, name, icon_path, seed_info, harvest_info, months_of_growth, months_of_harvest")
      .order("name")
      .returns<Plant[]>(),
    supabase
      .from("garden_bed")
      .select("id, name, width, height, pos_x, pos_y")
      .order("id")
      .returns<GardenBed[]>(),
    supabase
      .from("plant_bed")
      .select("id, plant_id, garden_bed_id, description, is_future")
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

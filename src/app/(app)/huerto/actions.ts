"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStorageUrl } from "@/lib/supabase/storage";
import type { GardenBed, Plant, PlantBed } from "@/types/garden";

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

  if (plantsRes.error) console.error("Error loading plant:", plantsRes.error);
  if (bedsRes.error) console.error("Error loading garden_bed:", bedsRes.error);
  if (plantBedsRes.error) console.error("Error loading plant_bed:", plantBedsRes.error);

  const plants = (plantsRes.data ?? []).map((p) => ({
    ...p,
    icon_path: getStorageUrl(p.icon_path),
  }));

  return {
    plants,
    beds: bedsRes.data ?? [],
    plantBeds: plantBedsRes.data ?? [],
  };
}

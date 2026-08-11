import type { GardenMode, PlantBed } from "@/types/garden";

// Actual = ocupaciones no futuras; Planificada = ocupaciones futuras.
// Conjuntos disjuntos sobre is_future, sin lógica de sustitución: un
// bancal sin ninguna fila futura simplemente no aparece en el modo
// planificada.
export function bedsForDistribution(
  plantBeds: PlantBed[],
  mode: GardenMode,
): Map<number, PlantBed[]> {
  const matches = plantBeds.filter((pb) =>
    mode === "actual" ? !pb.is_future : pb.is_future,
  );

  const distribution = new Map<number, PlantBed[]>();
  for (const pb of matches) {
    const rows = distribution.get(pb.garden_bed_id);
    if (rows) {
      rows.push(pb);
    } else {
      distribution.set(pb.garden_bed_id, [pb]);
    }
  }
  return distribution;
}

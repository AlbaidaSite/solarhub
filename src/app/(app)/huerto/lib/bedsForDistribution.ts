import type { GardenMode, PlantBed } from "@/types/garden";

// Actual = ocupaciones no futuras; Planificada = ocupaciones futuras.
// Conjuntos disjuntos sobre is_future, sin lógica de sustitución: un
// bancal sin ninguna fila futura simplemente no aparece en el modo
// planificada.
//
// Cada grupo sale ya ordenado por order_number (el orden que fija el
// usuario con el botón de mover, y que dicta qué subcelda ocupa cada
// cultivo), desempatando por id para que dos filas empatadas no bailen
// entre renders. Se ordena aquí y no en cada consumidor porque el lienzo
// y el modal del bancal tienen que ver exactamente la misma secuencia.
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

  for (const rows of distribution.values()) {
    rows.sort((a, b) => a.order_number - b.order_number || a.id - b.id);
  }
  return distribution;
}

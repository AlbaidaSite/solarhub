import type { GardenBed, Plant, PlantBed } from "@/types/garden";

// La fila existe pero su planta no se puede resolver (borrada, o nunca
// asignada). Se enseña igual: el hueco está ocupado en el bancal.
const UNKNOWN_CROP = "cultivo sin identificar";

export interface BedCropLine {
  key: string;
  name: string;
  // Lo que en BD es `description` y en el modal se edita como tipo: la
  // variedad concreta ("cherry", "de rama"). No todos los cultivos lo tienen.
  type: string | null;
  // Para pintar el punto de color del tooltip con el mismo color que la
  // subcelda del cultivo en el lienzo (ver plantColorClasses).
  color: string | null;
}

// Una entrada por cultivo del bancal, en el orden en que ya vienen las filas
// (order_number, ver bedsForDistribution). Fuente única del contenido que
// enseñan el tooltip del lienzo, la etiqueta accesible de cada bancal y la
// lista sr-only del modo de solo lectura.
export function bedCropLines(
  rows: PlantBed[],
  plantsById: Map<number, Plant>,
): BedCropLine[] {
  return rows.map((pb) => {
    const plant = pb.plant_id != null ? plantsById.get(pb.plant_id) : undefined;
    return {
      key: `pb-${pb.id}`,
      name: plant?.name ?? UNKNOWN_CROP,
      type: pb.description,
      color: plant?.color ?? null,
    };
  });
}

// "CULTIVO (TIPO)", con el tipo solo si lo tiene.
export function bedCropText(line: BedCropLine): string {
  return line.type ? `${line.name} (${line.type})` : line.name;
}

// El mismo contenido en una sola línea, para etiquetas y lectores de pantalla,
// donde no hay forma de dar formato a una lista.
export function bedSummary(
  bed: GardenBed,
  rows: PlantBed[],
  plantsById: Map<number, Plant>,
): string {
  const lines = bedCropLines(rows, plantsById);
  if (lines.length === 0) return `${bed.name}: vacío`;
  return `${bed.name}: ${lines.map(bedCropText).join(", ")}`;
}

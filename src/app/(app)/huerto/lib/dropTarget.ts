import { layoutFor } from "./subcells";
import type { GardenBed } from "@/types/garden";

export interface CanvasPoint {
  x: number;
  y: number;
}

// Bancal bajo el puntero, en coordenadas de lienzo. Los bancales no se
// solapan (es una premisa del huerto real), así que el primero que
// contenga el punto es el único candidato. Bordes incluidos: soltar
// justo sobre el contorno cuenta como dentro.
export function bedAtPoint(beds: GardenBed[], point: CanvasPoint): GardenBed | null {
  return (
    beds.find(
      (bed) =>
        point.x >= bed.pos_x &&
        point.x <= bed.pos_x + bed.width &&
        point.y >= bed.pos_y &&
        point.y <= bed.pos_y + bed.height,
    ) ?? null
  );
}

// Posición que ocuparía un cultivo soltado en `point` sobre un bancal
// que ya tiene `currentCount`. Se razona sobre la división RESULTANTE
// (currentCount + 1 subceldas), que es justo la que se está
// previsualizando: soltar en la franja de arriba de un bancal alto
// devuelve 0 y empuja a los demás hacia abajo; soltar en la de en medio
// devuelve 1 y los separa.
export function insertionIndexFor(
  bed: GardenBed,
  currentCount: number,
  point: CanvasPoint,
): number {
  const next = currentCount + 1;
  if (next <= 1) return 0;

  const layout = layoutFor(bed, next);

  if (layout === "diagonal") {
    // Diagonal de abajo-izquierda a arriba-derecha: normalizando el
    // punto dentro del bancal (u, v en 0..1), la recta es u + v = 1.
    // Por debajo de esa suma se está en el triángulo de arriba a la
    // izquierda, que es la posición 0 (ver diagonalSubcells).
    const u = (point.x - bed.pos_x) / bed.width;
    const v = (point.y - bed.pos_y) / bed.height;
    return u + v < 1 ? 0 : 1;
  }

  const offset =
    layout === "columns" ? point.x - bed.pos_x : point.y - bed.pos_y;
  const span = layout === "columns" ? bed.width : bed.height;

  const index = Math.floor((offset / span) * next);
  return Math.min(Math.max(index, 0), next - 1);
}

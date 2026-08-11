import type { GardenBed } from "@/types/garden";

export interface SubcellRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Divide el bancal en `count` partes iguales a lo largo de su
// dimensión mayor, para que las subceldas queden lo más cuadradas
// posible: bancal alto -> franjas horizontales apiladas, bancal ancho
// -> franjas verticales. Empate (cuadrado) -> columnas, por convención.
// Coordenadas absolutas en unidades de lienzo (incluyen pos_x/pos_y).
export function subcellsFor(bed: GardenBed, count: number): SubcellRect[] {
  if (count <= 0) return [];
  if (count === 1) {
    return [{ x: bed.pos_x, y: bed.pos_y, width: bed.width, height: bed.height }];
  }

  const columns = bed.width >= bed.height;
  const rects: SubcellRect[] = [];

  for (let i = 0; i < count; i++) {
    if (columns) {
      const width = bed.width / count;
      rects.push({ x: bed.pos_x + i * width, y: bed.pos_y, width, height: bed.height });
    } else {
      const height = bed.height / count;
      rects.push({ x: bed.pos_x, y: bed.pos_y + i * height, width: bed.width, height });
    }
  }

  return rects;
}

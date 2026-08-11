import { describe, it, expect } from "vitest";
import { subcellsFor } from "../subcells";
import type { GardenBed } from "@/types/garden";

function bed(overrides: Partial<GardenBed>): GardenBed {
  return { id: 1, name: "Bancal", width: 10, height: 10, pos_x: 0, pos_y: 0, ...overrides };
}

describe("subcellsFor", () => {
  it("count 0 devuelve un array vacío", () => {
    expect(subcellsFor(bed({}), 0)).toEqual([]);
  });

  it("count 1 devuelve el rectángulo completo del bancal", () => {
    const b = bed({ pos_x: 5, pos_y: 7, width: 10, height: 20 });
    expect(subcellsFor(b, 1)).toEqual([{ x: 5, y: 7, width: 10, height: 20 }]);
  });

  it("bancal ancho se divide en columnas verticales", () => {
    const b = bed({ pos_x: 0, pos_y: 0, width: 40, height: 10 });
    const rects = subcellsFor(b, 2);
    expect(rects).toEqual([
      { x: 0, y: 0, width: 20, height: 10 },
      { x: 20, y: 0, width: 20, height: 10 },
    ]);
  });

  it("bancal alto se divide en filas horizontales", () => {
    const b = bed({ pos_x: 0, pos_y: 0, width: 10, height: 40 });
    const rects = subcellsFor(b, 2);
    expect(rects).toEqual([
      { x: 0, y: 0, width: 10, height: 20 },
      { x: 0, y: 20, width: 10, height: 20 },
    ]);
  });

  it("bancal cuadrado desempata a columnas", () => {
    const b = bed({ pos_x: 0, pos_y: 0, width: 10, height: 10 });
    const rects = subcellsFor(b, 2);
    expect(rects[0].width).toBeLessThan(b.width);
    expect(rects[0].height).toBe(b.height);
  });

  it("las subceldas incluyen el desplazamiento pos_x/pos_y y tesela el bancal sin huecos", () => {
    const b = bed({ pos_x: 3, pos_y: 4, width: 9, height: 3 });
    const rects = subcellsFor(b, 3);
    expect(rects.map((r) => r.x)).toEqual([3, 6, 9]);
    const lastRect = rects[rects.length - 1];
    expect(lastRect.x + lastRect.width).toBe(b.pos_x + b.width);
  });
});

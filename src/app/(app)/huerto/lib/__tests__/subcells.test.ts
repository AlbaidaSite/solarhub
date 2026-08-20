import { describe, it, expect } from "vitest";
import { canAddCrop, layoutFor, subcellSizeFor, subcellsFor, MIN_SUBCELL_SIZE } from "../subcells";
import type { GardenBed } from "@/types/garden";

function bed(overrides: Partial<GardenBed>): GardenBed {
  return { id: 1, name: "Bancal", width: 100, height: 100, pos_x: 0, pos_y: 0, ...overrides };
}

// Caja envolvente del contorno de una subcelda: los polígonos ya vienen
// con los márgenes aplicados, así que comparar vértices exactos ataría
// los tests al valor concreto del margen. Se comprueba la geometría que
// importa (eje de división, orden, que nada se salga del bancal).
function bounds(points: [number, number][]) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

describe("layoutFor", () => {
  it("bancal ancho -> columnas, alto -> filas", () => {
    expect(layoutFor({ width: 300, height: 100 }, 3)).toBe("columns");
    expect(layoutFor({ width: 100, height: 300 }, 3)).toBe("rows");
  });

  it("cuadrado con 2 cultivos -> diagonal", () => {
    expect(layoutFor({ width: 160, height: 160 }, 2)).toBe("diagonal");
  });

  it("cuadrado con 3 o más vuelve a columnas: la diagonal no generaliza", () => {
    expect(layoutFor({ width: 160, height: 160 }, 3)).toBe("columns");
    expect(layoutFor({ width: 160, height: 160 }, 1)).toBe("columns");
  });
});

describe("subcellsFor", () => {
  it("count 0 devuelve un array vacío", () => {
    expect(subcellsFor(bed({}), 0)).toEqual([]);
  });

  it("count 1 ocupa el bancal entero salvo el margen", () => {
    const b = bed({ pos_x: 50, pos_y: 70, width: 100, height: 200 });
    const [cell] = subcellsFor(b, 1);
    const box = bounds(cell.points);

    expect(box.minX).toBeGreaterThan(b.pos_x);
    expect(box.maxX).toBeLessThan(b.pos_x + b.width);
    expect(box.minY).toBeGreaterThan(b.pos_y);
    expect(box.maxY).toBeLessThan(b.pos_y + b.height);
  });

  it("bancal ancho se divide en columnas de izquierda a derecha", () => {
    const cells = subcellsFor(bed({ width: 400, height: 100 }), 2);
    const [first, second] = cells.map((c) => bounds(c.points));

    expect(first.maxX).toBeLessThan(second.minX);
    expect(first.minY).toBeCloseTo(second.minY);
  });

  it("bancal alto se divide en filas de arriba abajo", () => {
    const cells = subcellsFor(bed({ width: 100, height: 400 }), 2);
    const [first, second] = cells.map((c) => bounds(c.points));

    expect(first.maxY).toBeLessThan(second.minY);
    expect(first.minX).toBeCloseTo(second.minX);
  });

  it("las subceldas respetan pos_x/pos_y y no se salen del bancal", () => {
    const b = bed({ pos_x: 30, pos_y: 40, width: 300, height: 90 });
    for (const cell of subcellsFor(b, 3)) {
      const box = bounds(cell.points);
      expect(box.minX).toBeGreaterThanOrEqual(b.pos_x);
      expect(box.maxX).toBeLessThanOrEqual(b.pos_x + b.width);
      expect(box.minY).toBeGreaterThanOrEqual(b.pos_y);
      expect(box.maxY).toBeLessThanOrEqual(b.pos_y + b.height);
    }
  });

  it("el corte diagonal da dos triángulos: primero el de arriba a la izquierda", () => {
    const b = bed({ pos_x: 0, pos_y: 0, width: 200, height: 200 });
    const [upperLeft, lowerRight] = subcellsFor(b, 2);

    expect(upperLeft.points).toHaveLength(3);
    expect(lowerRight.points).toHaveLength(3);

    // El ángulo recto de cada triángulo es su esquina del bancal.
    expect(upperLeft.icon.x).toBeLessThan(b.width / 2);
    expect(upperLeft.icon.y).toBeLessThan(b.height / 2);
    expect(lowerRight.icon.x + lowerRight.icon.width).toBeGreaterThan(b.width / 2);
    expect(lowerRight.icon.y + lowerRight.icon.height).toBeGreaterThan(b.height / 2);
  });

  it("la caja del icono de un triángulo es cuadrada y cabe dentro de él", () => {
    const b = bed({ pos_x: 0, pos_y: 0, width: 200, height: 200 });
    const [upperLeft] = subcellsFor(b, 2);
    const { x, y, width, height } = upperLeft.icon;

    expect(width).toBeCloseTo(height);
    // Mayor cuadrado inscrito en un triángulo rectángulo de catetos a y b:
    // a·b/(a+b). En un bancal de 200 (menos márgenes) ronda los 95.
    expect(width).toBeGreaterThan(80);
    expect(width).toBeLessThan(100);
    // La esquina opuesta al ángulo recto no puede cruzar la hipotenusa,
    // que en el triángulo de arriba a la izquierda es x + y = 200.
    expect(x + width + (y + height)).toBeLessThanOrEqual(200);
  });

  it("el icono de una subcelda rectangular no toca su contorno", () => {
    const b = bed({ pos_x: 0, pos_y: 0, width: 400, height: 100 });
    const [cell] = subcellsFor(b, 2);
    const box = bounds(cell.points);

    expect(cell.icon.x).toBeGreaterThan(box.minX);
    expect(cell.icon.y).toBeGreaterThan(box.minY);
    expect(cell.icon.x + cell.icon.width).toBeLessThan(box.maxX);
    expect(cell.icon.y + cell.icon.height).toBeLessThan(box.maxY);
  });

  it("en una celda alargada la caja del icono sigue siendo cuadrada y centrada", () => {
    // 300 de ancho por 100 de alto: si la caja siguiera la forma de la
    // celda, un icono sin proporción intrínseca (un SVG sin viewBox) se
    // estiraría tres veces a lo ancho.
    const b = bed({ pos_x: 0, pos_y: 0, width: 300, height: 100 });
    const [cell] = subcellsFor(b, 1);
    const box = bounds(cell.points);

    expect(cell.icon.width).toBe(cell.icon.height);
    // Manda la dimensión menor: el icono nunca es más alto que la celda.
    expect(cell.icon.height).toBeLessThan(box.maxY - box.minY);
    // Centrado en los dos ejes.
    expect(cell.icon.x + cell.icon.width / 2).toBeCloseTo((box.minX + box.maxX) / 2);
    expect(cell.icon.y + cell.icon.height / 2).toBeCloseTo((box.minY + box.maxY) / 2);
  });

  it("en una celda alta la caja del icono la limita el ancho", () => {
    const b = bed({ pos_x: 0, pos_y: 0, width: 100, height: 300 });
    const [cell] = subcellsFor(b, 1);
    const box = bounds(cell.points);

    expect(cell.icon.width).toBe(cell.icon.height);
    expect(cell.icon.width).toBeLessThan(box.maxX - box.minX);
  });
});

describe("subcellSizeFor / canAddCrop", () => {
  it("divide siempre la dimensión mayor", () => {
    expect(subcellSizeFor({ width: 300, height: 100 }, 3)).toBe(100);
    expect(subcellSizeFor({ width: 100, height: 300 }, 3)).toBe(100);
  });

  it("el primer cultivo entra siempre, por pequeño que sea el bancal", () => {
    expect(canAddCrop({ width: 10, height: 10 }, 0)).toBe(true);
  });

  it("rechaza el cultivo que dejaría las divisiones por debajo del mínimo", () => {
    // 180 / 3 = 60 (vale), 180 / 4 = 45 (no).
    const b = { width: 180, height: 80 };
    expect(canAddCrop(b, 2)).toBe(true);
    expect(canAddCrop(b, 3)).toBe(false);
  });

  it("el límite es inclusivo: justo MIN_SUBCELL_SIZE sí cabe", () => {
    const exact = { width: MIN_SUBCELL_SIZE * 2, height: 30 };
    expect(canAddCrop(exact, 1)).toBe(true);

    const justUnder = { width: MIN_SUBCELL_SIZE * 2 - 1, height: 30 };
    expect(canAddCrop(justUnder, 1)).toBe(false);
  });
});

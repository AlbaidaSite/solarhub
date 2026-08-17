import { describe, it, expect } from "vitest";
import {
  constellationBounds,
  constellationExtent,
  constellationSegments,
} from "../constellation";
import { MENU_ITEMS } from "@/constants/navigation";
import type { Dot } from "@/types/navigation";

describe("constellationSegments", () => {
  it("une cada punto con los que declara en connectsTo", () => {
    const dots: Dot[] = [
      { x: 0, y: 0, size: 4, connectsTo: [1, 2] },
      { x: 10, y: 0, size: 4 },
      { x: 0, y: 10, size: 4 },
    ];

    expect(constellationSegments(dots)).toEqual([
      { key: "0-1", x1: 0, y1: 0, x2: 10, y2: 0 },
      { key: "0-2", x1: 0, y1: 0, x2: 0, y2: 10 },
    ]);
  });

  // Los puntos se escriben a mano en constants/navigation.ts: un índice que
  // se quede colgado al reordenarlos no puede dejar la home en blanco.
  it("ignora los enlaces a puntos que no existen", () => {
    const dots: Dot[] = [{ x: 0, y: 0, size: 4, connectsTo: [9] }];
    expect(constellationSegments(dots)).toEqual([]);
  });

  it("un punto sin connectsTo no dibuja nada", () => {
    expect(constellationSegments([{ x: 3, y: 4, size: 4 }])).toEqual([]);
  });
});

describe("constellationBounds", () => {
  it("mide la caja de las estrellas contando su radio", () => {
    expect(
      constellationBounds([
        { x: -10, y: 0, size: 4 },
        { x: 20, y: 8, size: 4 },
      ]),
    ).toEqual({ centerX: 5, centerY: 4, width: 34, height: 12 });
  });

  // Cromos no está centrada en su caja: sus puntos van de -15 a 23.
  it("una constelación descentrada no devuelve el origen", () => {
    const cromos = MENU_ITEMS[0].dots ?? [];
    expect(constellationBounds(cromos).centerX).toBeGreaterThan(1);
  });

  it("sin estrellas no hay caja", () => {
    expect(constellationBounds([])).toEqual({
      centerX: 0,
      centerY: 0,
      width: 0,
      height: 0,
    });
  });
});

describe("constellationExtent", () => {
  it("cubre el punto más lejano contando su radio", () => {
    const extent = constellationExtent([
      [{ x: 10, y: 0, size: 4 }],
      [{ x: 0, y: -20, size: 6 }],
    ]);
    expect(extent).toBe(23);
  });

  it("es una sola medida para todas: ninguna constelación se sale de ella", () => {
    const extent = constellationExtent(MENU_ITEMS.map((item) => item.dots ?? []));

    for (const item of MENU_ITEMS) {
      for (const dot of item.dots ?? []) {
        expect(Math.abs(dot.x) + dot.size / 2).toBeLessThanOrEqual(extent);
        expect(Math.abs(dot.y) + dot.size / 2).toBeLessThanOrEqual(extent);
      }
    }
  });

  it("sin puntos no hay caja", () => {
    expect(constellationExtent([])).toBe(0);
  });
});

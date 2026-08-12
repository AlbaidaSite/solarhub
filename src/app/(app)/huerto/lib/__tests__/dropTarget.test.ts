import { describe, it, expect } from "vitest";
import { bedAtPoint, insertionIndexFor } from "../dropTarget";
import type { GardenBed } from "@/types/garden";

function bed(overrides: Partial<GardenBed> & { id: number }): GardenBed {
  return { name: "Bancal", width: 100, height: 100, pos_x: 0, pos_y: 0, ...overrides };
}

describe("bedAtPoint", () => {
  const beds = [
    bed({ id: 1, pos_x: 0, pos_y: 0, width: 100, height: 100 }),
    bed({ id: 2, pos_x: 200, pos_y: 0, width: 100, height: 100 }),
  ];

  it("encuentra el bancal que contiene el punto", () => {
    expect(bedAtPoint(beds, { x: 50, y: 50 })?.id).toBe(1);
    expect(bedAtPoint(beds, { x: 250, y: 10 })?.id).toBe(2);
  });

  it("el borde cuenta como dentro", () => {
    expect(bedAtPoint(beds, { x: 100, y: 100 })?.id).toBe(1);
  });

  it("fuera de todos los bancales devuelve null", () => {
    expect(bedAtPoint(beds, { x: 150, y: 50 })).toBeNull();
    expect(bedAtPoint(beds, { x: 50, y: -1 })).toBeNull();
  });
});

describe("insertionIndexFor", () => {
  it("en un bancal vacío siempre es la posición 0", () => {
    const b = bed({ id: 1, width: 100, height: 300 });
    expect(insertionIndexFor(b, 0, { x: 50, y: 290 })).toBe(0);
  });

  it("bancal alto: soltar arriba compacta a los demás hacia abajo", () => {
    // Dos cultivos + el que se arrastra = 3 franjas de 100.
    const b = bed({ id: 1, width: 100, height: 300 });
    expect(insertionIndexFor(b, 2, { x: 50, y: 10 })).toBe(0);
    expect(insertionIndexFor(b, 2, { x: 50, y: 150 })).toBe(1);
    expect(insertionIndexFor(b, 2, { x: 50, y: 290 })).toBe(2);
  });

  it("bancal ancho: el reparto es por columnas", () => {
    const b = bed({ id: 1, width: 300, height: 100 });
    expect(insertionIndexFor(b, 1, { x: 10, y: 50 })).toBe(0);
    expect(insertionIndexFor(b, 1, { x: 290, y: 50 })).toBe(1);
  });

  it("bancal cuadrado con un cultivo: manda el lado de la diagonal", () => {
    const b = bed({ id: 1, width: 200, height: 200 });
    // El corte va de abajo-izquierda a arriba-derecha, así que esas dos
    // esquinas son de los dos triángulos a la vez: los lados se
    // distinguen por las OTRAS dos.
    expect(insertionIndexFor(b, 1, { x: 20, y: 20 })).toBe(0);
    expect(insertionIndexFor(b, 1, { x: 180, y: 180 })).toBe(1);
    // Pegado al extremo superior derecho del corte, pero por encima de
    // él: sigue siendo el triángulo de arriba a la izquierda.
    expect(insertionIndexFor(b, 1, { x: 190, y: 5 })).toBe(0);
    // Y justo por debajo del corte, cerca de la esquina de abajo a la
    // izquierda: el otro.
    expect(insertionIndexFor(b, 1, { x: 30, y: 190 })).toBe(1);
  });

  it("soltar justo en el borde no se sale del rango", () => {
    const b = bed({ id: 1, width: 300, height: 100 });
    expect(insertionIndexFor(b, 2, { x: 300, y: 50 })).toBe(2);
    expect(insertionIndexFor(b, 2, { x: 0, y: 50 })).toBe(0);
  });
});

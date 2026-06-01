// SUT: src/app/staff/lib/codeGeneration.ts
// Cubre RF-014 (generación en lote), RN-008 (unicidad por categoría — la
// unicidad la enforza el caller a través del set `used`) y RN-009 (codes
// reservados — también vía `used`).

import { describe, it, expect } from "vitest";
import {
  SMALLINT_MAX,
  SMALLINT_MIN,
  SMALLINT_RANGE,
  pickUniqueCodes,
  rejectionSample,
  pickFromFreePool,
} from "@/app/staff/lib/codeGeneration";

// PRNG determinista para reproducibilidad. Mulberry32 → 32 bits, suficiente.
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe("RF-014 · pickUniqueCodes (entrada principal)", () => {
  it("N = 0 devuelve lista vacía", () => {
    expect(pickUniqueCodes(new Set(), 0)).toEqual([]);
  });

  it("genera N códigos sin colisión con los ya usados ni con los reservados", () => {
    const used = new Set<number>([10, 20, 30, -40, -50]);
    const result = pickUniqueCodes(used, 100, mulberry32(1));
    expect(result).toHaveLength(100);
    for (const code of result) {
      expect(used.has(code)).toBe(true); // pickUniqueCodes muta `used`
    }
    // Comprueba que ninguno coincide con los originales (mutados aparte).
    const originals = [10, 20, 30, -40, -50];
    const intersection = result.filter((c) => originals.includes(c));
    expect(intersection).toEqual([]);
  });

  it("los N códigos están dentro del rango smallint", () => {
    const codes = pickUniqueCodes(new Set(), 200, mulberry32(2));
    for (const c of codes) {
      expect(c).toBeGreaterThanOrEqual(SMALLINT_MIN);
      expect(c).toBeLessThanOrEqual(SMALLINT_MAX);
      expect(Number.isInteger(c)).toBe(true);
    }
  });

  it("los N códigos son distintos entre sí (RN-008)", () => {
    const codes = pickUniqueCodes(new Set(), 500, mulberry32(3));
    const distinct = new Set(codes);
    expect(distinct.size).toBe(codes.length);
  });

  it("misma semilla y mismo estado producen mismo resultado (generador determinista)", () => {
    const a = pickUniqueCodes(new Set([1, 2, 3]), 50, mulberry32(42));
    const b = pickUniqueCodes(new Set([1, 2, 3]), 50, mulberry32(42));
    expect(a).toEqual(b);
  });

  it("semillas distintas producen secuencias distintas", () => {
    const a = pickUniqueCodes(new Set(), 50, mulberry32(1));
    const b = pickUniqueCodes(new Set(), 50, mulberry32(2));
    expect(a).not.toEqual(b);
  });
});

describe("RN-009 · respeta codes reservados (vía set `used`)", () => {
  it("ningún código devuelto coincide con los reservados", () => {
    // Reservados que cubren un bloque concreto para detectar regresiones.
    const reservados = new Set<number>([0, 1, -1, SMALLINT_MIN, SMALLINT_MAX]);
    const result = pickUniqueCodes(new Set(reservados), 100, mulberry32(7));
    for (const code of result) {
      expect(reservados.has(code)).toBe(false);
    }
  });
});

describe("rejectionSample (algoritmo baja densidad)", () => {
  it("muta `used` para evitar duplicados dentro de la misma llamada", () => {
    const used = new Set<number>();
    rejectionSample(used, 64, mulberry32(11));
    expect(used.size).toBe(64); // los 64 nuevos quedaron registrados
  });
});

describe("pickFromFreePool (algoritmo alta densidad)", () => {
  it("funciona cuando el espacio libre es exactamente N", () => {
    // Construye un escenario donde solo quedan 3 codes libres.
    const used = new Set<number>();
    for (let i = SMALLINT_MIN; i <= SMALLINT_MAX; i++) used.add(i);
    used.delete(-1);
    used.delete(0);
    used.delete(1);
    const result = pickFromFreePool(used, 3, mulberry32(13));
    expect(result.sort((a, b) => a - b)).toEqual([-1, 0, 1]);
  });
});

describe("RF-014 · contrato de espacio insuficiente", () => {
  // El módulo NO comprueba `copies <= free` (eso lo hace el caller en
  // `generateCodesAction`). Pero documentamos qué pasa si se invoca con
  // copies > espacio libre usando pickFromFreePool: devuelve menos códigos
  // de los pedidos sin lanzar excepción. Importante para que el caller
  // siga gateando con `copies > free → error`.
  it("pickFromFreePool con copies > free devuelve un array no fiable (precondición rota)", () => {
    const used = new Set<number>();
    for (let i = SMALLINT_MIN; i <= SMALLINT_MAX; i++) used.add(i);
    used.delete(42);
    // Solo queda 1 hueco libre; pedimos 5.
    const result = pickFromFreePool(used, 5, mulberry32(17));
    // Comportamiento actual: el primer slot contiene 42 (el único libre);
    // los siguientes son undefined porque Fisher-Yates no encuentra dónde
    // permutar. Esto es un GAP documentado: el módulo asume copies <= free
    // y el caller (`generateCodesAction`) lo enforza antes de invocar.
    expect(result[0]).toBe(42);
    expect(result.length).toBe(5);
    expect(result.slice(1).every((v) => v === undefined)).toBe(true);
  });
});

describe("propiedades estructurales", () => {
  it("SMALLINT_RANGE = 65 536", () => {
    expect(SMALLINT_RANGE).toBe(65536);
  });
});

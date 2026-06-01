// SUT: src/app/(app)/cromos/lib/code.ts
// Cubre RN-007 (lectura de cuadrículas 4×4 ↔ entero de 16 bits con signo).

import { describe, it, expect } from "vitest";
import {
  CELL_COUNT,
  SMALLINT_MAX,
  SMALLINT_MIN,
  computeCode,
  decodeCode,
} from "@/app/(app)/cromos/lib/code";

// Helpers locales para describir cuadrículas legibles en los tests.
const zeros = (): boolean[] => Array(CELL_COUNT).fill(false);
const ones = (): boolean[] => Array(CELL_COUNT).fill(true);

// Convierte un string como "0000 0000 0000 0001" a boolean[16] en orden lectura.
function bitString(s: string): boolean[] {
  const flat = s.replace(/\s+/g, "");
  if (flat.length !== CELL_COUNT) {
    throw new Error(`bitString debe tener ${CELL_COUNT} bits, recibí ${flat.length}`);
  }
  return [...flat].map((c) => c === "1");
}

describe("RN-007 · computeCode (cuadrícula → entero)", () => {
  it("cuadrícula vacía equivale a 0", () => {
    expect(computeCode(zeros())).toBe(0);
  });

  it("solo la celda 15 (bit 0) equivale a 1", () => {
    expect(computeCode(bitString("0000 0000 0000 0001"))).toBe(1);
  });

  it("todas las celdas salvo la 0 dan 32 767 (máximo positivo)", () => {
    expect(computeCode(bitString("0111 1111 1111 1111"))).toBe(SMALLINT_MAX);
    expect(SMALLINT_MAX).toBe(32767);
  });

  it("solo la celda 0 (bit de signo) da -32 768", () => {
    expect(computeCode(bitString("1000 0000 0000 0000"))).toBe(SMALLINT_MIN);
    expect(SMALLINT_MIN).toBe(-32768);
  });

  it("todas las celdas activas dan -1 (complemento a 2)", () => {
    expect(computeCode(ones())).toBe(-1);
  });

  it("ejemplo de la memoria: 0001 0111 0110 1101 → 5997", () => {
    expect(computeCode(bitString("0001 0111 0110 1101"))).toBe(5997);
  });
});

describe("RN-007 · decodeCode (entero → cuadrícula)", () => {
  it("0 devuelve todas las celdas a false", () => {
    expect(decodeCode(0)).toEqual(zeros());
  });

  it("1 devuelve solo la última celda activa", () => {
    expect(decodeCode(1)).toEqual(bitString("0000 0000 0000 0001"));
  });

  it("-1 devuelve todas las celdas activas", () => {
    expect(decodeCode(-1)).toEqual(ones());
  });

  it("-32 768 devuelve solo la celda de signo activa", () => {
    expect(decodeCode(SMALLINT_MIN)).toEqual(bitString("1000 0000 0000 0000"));
  });

  it("32 767 devuelve todas activas salvo la celda de signo", () => {
    expect(decodeCode(SMALLINT_MAX)).toEqual(bitString("0111 1111 1111 1111"));
  });

  it("5997 devuelve el patrón documentado en la memoria", () => {
    expect(decodeCode(5997)).toEqual(bitString("0001 0111 0110 1101"));
  });
});

describe("RN-007 · round-trip", () => {
  // PRNG determinista pequeño (Mulberry32) para reproducibilidad de los tests
  // sin depender de Math.random.
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

  it("decode(encode(grid)) === grid para 50 cuadrículas pseudo-aleatorias", () => {
    const rng = mulberry32(0xc0ffee);
    for (let iter = 0; iter < 50; iter++) {
      const grid: boolean[] = [];
      for (let i = 0; i < CELL_COUNT; i++) grid.push(rng() < 0.5);
      const code = computeCode(grid);
      expect(decodeCode(code)).toEqual(grid);
    }
  });

  it("encode(decode(n)) === n para valores frontera", () => {
    const samples = [SMALLINT_MIN, -1, 0, 1, 5997, SMALLINT_MAX];
    for (const n of samples) {
      expect(computeCode(decodeCode(n))).toBe(n);
    }
  });
});

describe("RN-007 · comportamiento ante input no canónico (gap documentado)", () => {
  // La implementación actual NO valida explícitamente la longitud ni los
  // tipos de las celdas: las celdas faltantes se tratan como `false` y los
  // valores truthy/falsy se interpretan según el operador `!cells[i]`. Estos
  // tests fijan ese comportamiento (no lo proponen como ideal); el TESTING_REPORT
  // marca esto como gap si se quiere enforzar entradas estrictas.

  it("array más corto: las celdas que faltan se interpretan como false", () => {
    // Pasamos solo 4 celdas (las 12 restantes son `undefined` → falsy).
    const partial = [false, true, false, true] as boolean[];
    // Solo aporta la celda 1 (peso 2^14 = 16384) y la 3 (peso 2^12 = 4096).
    expect(computeCode(partial)).toBe(16384 + 4096);
  });

  it("array vacío produce 0", () => {
    expect(computeCode([])).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import {
  anchoFluido,
  ANCHO_MAX_VH,
  RESERVA_FORMULARIO,
  TAMANO_POR_DEFECTO,
  desplazamientoAversion,
  desplazamientoOjo,
  G,
  LLAMAS,
  transformacionOrbita,
} from "../geometria";

describe("desplazamientoOjo", () => {
  it("dx=0, dy=0 → {0, 0}", () => {
    expect(desplazamientoOjo(0, 0, 50)).toEqual({ x: 0, y: 0 });
  });

  it("tope = 0 → {0, 0}", () => {
    expect(desplazamientoOjo(100, 100, 0)).toEqual({ x: 0, y: 0 });
  });

  it("d muy grande en varias direcciones → módulo === tope", () => {
    const tope = 50;
    const saturacion = 340;
    for (let angulo = 0; angulo < 360; angulo += 15) {
      const rad = (angulo * Math.PI) / 180;
      const dx = Math.cos(rad) * saturacion * 10;
      const dy = Math.sin(rad) * saturacion * 10;
      const { x, y } = desplazamientoOjo(dx, dy, tope, saturacion);
      expect(Math.hypot(x, y)).toBeCloseTo(tope, 9);
    }
  });

  it("d = saturacion / 2 → módulo === tope / 2", () => {
    const tope = 50;
    const saturacion = 340;
    const { x, y } = desplazamientoOjo(saturacion / 2, 0, tope, saturacion);
    expect(Math.hypot(x, y)).toBeCloseTo(tope / 2, 9);
  });

  it("barrido de ángulos cada 15° a distancia > saturación: módulo <= tope siempre", () => {
    const tope = 50;
    const saturacion = 340;
    for (let angulo = 0; angulo < 360; angulo += 15) {
      const rad = (angulo * Math.PI) / 180;
      const dx = Math.cos(rad) * saturacion * 3;
      const dy = Math.sin(rad) * saturacion * 3;
      const { x, y } = desplazamientoOjo(dx, dy, tope, saturacion);
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(tope + 1e-9);
    }
  });

  it("dirección: el resultado es colineal y del mismo sentido que el vector de entrada", () => {
    const tope = 50;
    const saturacion = 340;
    const casos: [number, number][] = [
      [120, 40],
      [-80, 200],
      [-150, -90],
      [30, -260],
    ];
    for (const [dx, dy] of casos) {
      const { x, y } = desplazamientoOjo(dx, dy, tope, saturacion);
      const cruz = dx * y - dy * x;
      const punto = dx * x + dy * y;
      expect(cruz).toBeCloseTo(0, 6);
      expect(punto).toBeGreaterThan(0);
    }
  });

  it("dx o dy negativos: el signo del resultado es coherente", () => {
    const tope = 50;
    const saturacion = 340;
    const { x: x1, y: y1 } = desplazamientoOjo(-100, 50, tope, saturacion);
    expect(x1).toBeLessThan(0);
    expect(y1).toBeGreaterThan(0);

    const { x: x2, y: y2 } = desplazamientoOjo(100, -50, tope, saturacion);
    expect(x2).toBeGreaterThan(0);
    expect(y2).toBeLessThan(0);
  });
});

describe("desplazamientoAversion", () => {
  const tope = 50;

  it("tope = 0 → {0, 0}", () => {
    expect(desplazamientoAversion(-100, 0)).toEqual({ x: 0, y: 0 });
  });

  it("campo a la izquierda → el ojo mira arriba y a la derecha", () => {
    const { x, y } = desplazamientoAversion(-300, tope);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeLessThan(0);
  });

  it("campo a la derecha → el ojo mira arriba y a la izquierda", () => {
    const { x, y } = desplazamientoAversion(300, tope);
    expect(x).toBeLessThan(0);
    expect(y).toBeLessThan(0);
  });

  it("apartar la vista tampoco saca el ojo del círculo: módulo === tope", () => {
    for (const lado of [-300, -1, 0, 1, 300]) {
      const { x, y } = desplazamientoAversion(lado, tope);
      expect(Math.hypot(x, y)).toBeCloseTo(tope, 9);
    }
  });

  it("a 45° las dos componentes tienen el mismo tamaño", () => {
    const { x, y } = desplazamientoAversion(-300, tope);
    expect(Math.abs(x)).toBeCloseTo(Math.abs(y), 9);
  });
});

describe("anchoFluido", () => {
  it("acota el ancho por size, por el hueco libre y por el alto de ventana", () => {
    expect(anchoFluido(340)).toBe(
      `min(340px, calc(50vw - ${RESERVA_FORMULARIO}px), ${ANCHO_MAX_VH}vh)`,
    );
  });

  // Comprobación de la propia fórmula: el hueco entre formularios mide
  // 2 × (mitad de la ventana − RESERVA_FORMULARIO), y Ciro va centrado, así
  // que su ancho sale de ahí en cuanto la ventana deja de dar para el tamaño
  // completo.
  it("el término en calc equivale al hueco libre entre los dos formularios", () => {
    const anchoLibre = (ventana: number) => ventana / 2 - RESERVA_FORMULARIO;
    // A 1366px todavía cabe a tamaño completo; a 1280 ya tiene que encoger.
    expect(anchoLibre(1366)).toBeGreaterThan(TAMANO_POR_DEFECTO);
    expect(anchoLibre(1280)).toBeLessThan(TAMANO_POR_DEFECTO);
    expect(anchoLibre(1280)).toBeGreaterThan(0);
  });

  // La reserva le permite a la punta de la llama morder un poco el margen
  // del formulario, pero solo un poco: si se pasara del no-solape estricto
  // (320) en más de lo previsto, Ciro se plantaría encima de los campos.
  it("no invade el formulario más allá del margen previsto", () => {
    const NO_SOLAPE_ESTRICTO = 384 - 64;
    const invasionPorLado = (NO_SOLAPE_ESTRICTO - RESERVA_FORMULARIO) / 2;
    expect(invasionPorLado).toBeGreaterThanOrEqual(0);
    expect(invasionPorLado).toBeLessThanOrEqual(32);
  });
});

describe("transformacionOrbita", () => {
  it("compone translate/rotate/translateY en el orden esperado", () => {
    expect(transformacionOrbita(45, "34.5cqw")).toBe(
      "translate(-50%, -50%) rotate(45deg) translateY(calc(-1 * 34.5cqw))",
    );
  });
});

describe("LLAMAS", () => {
  it("tiene 8 entradas, 4 de cada tipo", () => {
    expect(LLAMAS).toHaveLength(8);
    expect(LLAMAS.filter((l) => l.tipo === "largo")).toHaveLength(4);
    expect(LLAMAS.filter((l) => l.tipo === "corto")).toHaveLength(4);
  });

  it("los ángulos son únicos", () => {
    const angulos = LLAMAS.map((l) => l.angulo);
    expect(new Set(angulos).size).toBe(angulos.length);
  });

  it("los ángulos de corto son los de largo desplazados 45°", () => {
    const largos = LLAMAS.filter((l) => l.tipo === "largo").map((l) => l.angulo);
    const cortos = LLAMAS.filter((l) => l.tipo === "corto").map((l) => l.angulo);
    for (const angulo of cortos) {
      expect(largos).toContain((angulo - 45 + 360) % 360);
    }
  });
});

describe("G · invariante de contención", () => {
  it("el fondo queda íntegramente dentro de la cara", () => {
    expect(G.fondoDy + G.fondo / 2).toBeLessThan(G.cara / 2);
  });
});

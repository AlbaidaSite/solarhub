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

  // RESERVA_FORMULARIO es una constante de calibración: se toca a ojo hasta
  // que Ciro se ve bien (§11). Por eso lo que se fija aquí NO es su valor,
  // sino las dos propiedades que tienen que seguir cumpliéndose la toque
  // quien la toque.

  // Lado del contenedor a un ancho de ventana dado, replicando el min() de
  // anchoFluido. Se ignora el término en vh: solo puede achicar, así que
  // omitirlo deja las comprobaciones del lado seguro.
  const anchoEn = (ventana: number) =>
    Math.min(TAMANO_POR_DEFECTO, ventana / 2 - RESERVA_FORMULARIO);

  // Distancia del centro de la ventana al borde del formulario, según la
  // maquetación de AuthView: cada mitad lleva pr-16/pl-16 (64px) y el
  // formulario es w-full max-w-sm (384px) centrado en lo que queda.
  const huecoAlFormulario = (ventana: number) => {
    const caja = ventana / 2 - 64;
    const formulario = Math.min(384, caja);
    return ventana / 2 - (caja / 2 + formulario / 2);
  };

  const ANCHOS = [768, 900, 1024, 1152, 1280, 1366, 1440, 1920, 2560];

  // A las puntas de las llamas se les deja morder el borde del formulario a
  // propósito, pero al cuerpo opaco no: si la cara llegara a taparlo, ya no
  // sería un adorno sino un estorbo encima de los campos.
  it("la cara nunca alcanza el formulario, por estrecha que sea la ventana", () => {
    for (const ventana of ANCHOS) {
      const semiCara = (anchoEn(ventana) * G.cara) / 2;
      expect(semiCara).toBeLessThan(huecoAlFormulario(ventana));
    }
  });

  it("Ciro sigue siendo visible y nunca pasa de su tamaño máximo", () => {
    for (const ventana of ANCHOS) {
      expect(anchoEn(ventana)).toBeGreaterThan(0);
      expect(anchoEn(ventana)).toBeLessThanOrEqual(TAMANO_POR_DEFECTO);
    }
  });

  it("encoge de forma monótona: a menos ventana, nunca más Ciro", () => {
    for (let i = 1; i < ANCHOS.length; i++) {
      expect(anchoEn(ANCHOS[i])).toBeGreaterThanOrEqual(anchoEn(ANCHOS[i - 1]));
    }
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

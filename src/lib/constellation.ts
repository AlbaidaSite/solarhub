import type { Dot } from "@/types/navigation";

// Las constelaciones del menú (ver src/constants/navigation.ts) son listas
// de puntos con coordenadas relativas a su centro —del orden de ±22— y una
// lista de índices a los que cada punto se une. El navbar las dibuja a
// tamaño fijo con <div> absolutos; estas funciones son la traducción de esa
// misma geometría a un <svg> que pueda escalarse a pantalla completa.

export interface ConstellationSegment {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Une cada punto con aquellos a los que apunta su connectsTo. Un índice que
// no exista se ignora en vez de romper el dibujo: la lista de puntos se
// edita a mano y un enlace suelto no debe dejar la vista en blanco.
export function constellationSegments(dots: Dot[]): ConstellationSegment[] {
  const segments: ConstellationSegment[] = [];

  dots.forEach((dot, index) => {
    for (const target of dot.connectsTo ?? []) {
      const other = dots[target];
      if (!other) continue;
      segments.push({
        key: `${index}-${target}`,
        x1: dot.x,
        y1: dot.y,
        x2: other.x,
        y2: other.y,
      });
    }
  });

  return segments;
}

export interface ConstellationBounds {
  // Centro del dibujo, que no tiene por qué ser el origen: los puntos de
  // Cromos, por ejemplo, van de -15 a 23 en horizontal, así que su
  // constelación cae claramente a la derecha del centro de la caja
  // compartida.
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

// Caja que ocupan de verdad las estrellas de UNA constelación (contando su
// radio). Con esto el icono que se superpone al pasar el ratón se planta
// donde está la constelación y ocupa lo mismo que ella, en vez de ir
// centrado y a un tamaño fijo dentro de la caja común.
export function constellationBounds(dots: Dot[]): ConstellationBounds {
  if (dots.length === 0) return { centerX: 0, centerY: 0, width: 0, height: 0 };

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const dot of dots) {
    const radius = dot.size / 2;
    minX = Math.min(minX, dot.x - radius);
    maxX = Math.max(maxX, dot.x + radius);
    minY = Math.min(minY, dot.y - radius);
    maxY = Math.max(maxY, dot.y + radius);
  }

  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// Radio de la caja cuadrada, centrada en el origen, que envuelve a TODAS
// las constelaciones a la vez (contando el radio de cada estrella).
//
// La medida es compartida a propósito: si cada constelación se ajustase a
// su propia caja, la de Cromos —bastante más estrecha que el resto— se
// dibujaría al mismo ancho que las demás y perdería la proporción que
// tienen entre sí en el navbar.
export function constellationExtent(constellations: Dot[][]): number {
  let extent = 0;

  for (const dots of constellations) {
    for (const dot of dots) {
      const radius = dot.size / 2;
      extent = Math.max(extent, Math.abs(dot.x) + radius, Math.abs(dot.y) + radius);
    }
  }

  return extent;
}

import type { CanvasPoint } from "./dropTarget";

// Traduce coordenadas de puntero (clientX/clientY) a unidades de lienzo.
// El <svg> se escala solo para caber en su hueco (viewBox +
// preserveAspectRatio), así que el factor no se puede calcular a mano: se
// pide la matriz que el propio navegador está aplicando y se invierte.
//
// Devuelve null cuando esa matriz no existe: el SVG todavía no está en el
// documento, o el entorno no implementa getScreenCTM (jsdom, en los
// tests). Quien llama trata ese caso como "el puntero no está sobre
// ningún bancal".
export function clientToCanvasPoint(
  svg: SVGSVGElement | null,
  clientX: number,
  clientY: number,
): CanvasPoint | null {
  if (!svg || typeof svg.getScreenCTM !== "function") return null;

  const ctm = svg.getScreenCTM();
  if (!ctm) return null;

  const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: point.x, y: point.y };
}

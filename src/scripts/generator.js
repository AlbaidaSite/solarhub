// Utilidades para generar el SVG-grid asociado a un code de unique_cromo
// y empaquetar todos los SVGs de un cromo en un .zip descargable.
//
// El code es un smallint signed (16 bits, complemento a 2): rango [-32768, 32767].
//   · cell 0 (arriba-izquierda) = bit 15 (signo): si está activa contribuye -2^15
//   · cells 1..15 = bits 14..0: contribuyen 2^14..2^0
//
// Antes este script vivía dentro de una vista Django; los handlers DOM,
// el fetch a /save-unique-codes/ y el CSRFToken se han retirado: ahora es
// un módulo puro pensado para ser invocado desde React (CromoCreateForm).

import JSZip from "jszip";

const CIRCLE_SIZE = 50;
const ROWS = 4;
const COLS = 4;
const CIRCLE_COLOR = "#90713b";
const GRADIENT_START = "#806845";
const GRADIENT_END = "#b19159";

/**
 * Convierte un code (smallint signed) en su representación bit-a-bit en
 * orden lectura (top-left = bit 15, bottom-right = bit 0). Esto encaja
 * con la disposición del grid 4x4 usada en RegisterCromoForm.
 *
 * @param {number} code  Número entero en el rango [-32768, 32767].
 * @returns {number[]}   Array de 16 valores 0/1 (top-left primero).
 */
export function codeToBits(code) {
  // `& 0xffff` reinterpreta el signed como unsigned 16 bits sin perder
  // información. Funciona igual para positivos y negativos (complemento a 2):
  //   -32768 & 0xffff = 0x8000 → bit 15 = 1
  //   -1     & 0xffff = 0xffff → todos los bits a 1
  //    1     & 0xffff = 0x0001 → solo bit 0
  const unsigned = code & 0xffff;
  const bits = new Array(16);
  for (let i = 0; i < 16; i++) {
    const bitPos = 15 - i;
    bits[i] = (unsigned >> bitPos) & 1;
  }
  return bits;
}

/**
 * Genera el SVG (string) del grid 4x4 a partir de los 16 bits.
 *
 * @param {number[]} bits  Array de 16 ceros/unos (en orden lectura).
 * @returns {string}       Markup SVG completo.
 */
export function generateGridSvg(bits) {
  const width = COLS * CIRCLE_SIZE + 1;
  const height = ROWS * CIRCLE_SIZE + 1;
  const viewBox = `-1 -1 ${COLS * CIRCLE_SIZE + 2} ${ROWS * CIRCLE_SIZE + 2}`;

  const circles = bits
    .map((on, i) => {
      const row = Math.floor(i / COLS);
      const col = i % COLS;
      const cx = col * CIRCLE_SIZE + CIRCLE_SIZE / 2;
      const cy = row * CIRCLE_SIZE + CIRCLE_SIZE / 2;
      const r = CIRCLE_SIZE / 2;
      const fill = on === 1 ? "url(#gradientFill)" : "transparent";
      return `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${CIRCLE_COLOR}" stroke-width="2" fill="${fill}"/>`;
    })
    .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">` +
    `<defs>` +
    `<linearGradient id="gradientFill" x1="0%" y1="0%" x2="0%" y2="100%">` +
    `<stop offset="0%" stop-color="${GRADIENT_START}" stop-opacity="0.5"/>` +
    `<stop offset="100%" stop-color="${GRADIENT_END}" stop-opacity="0.5"/>` +
    `</linearGradient>` +
    `</defs>` +
    `${circles}` +
    `</svg>`
  );
}

/**
 * Construye el SVG directamente a partir del code (atajo conveniente).
 */
export function generateGridSvgFromCode(code) {
  return generateGridSvg(codeToBits(code));
}

/**
 * Genera un ZIP con un SVG por code y dispara su descarga en el navegador.
 *
 * @param {number[]} codes      Codes en orden de copia (idx + 1 = copy_number).
 * @param {string}   cromoName
 * @param {number}   cromoNumber
 */
export async function downloadCromoCodesZip(codes, cromoName, cromoNumber) {
  if (typeof window === "undefined") {
    throw new Error("downloadCromoCodesZip solo puede ejecutarse en el navegador.");
  }

  const zip = new JSZip();

  codes.forEach((code, i) => {
    const svg = generateGridSvgFromCode(code);
    const filename = `grid-${i + 1}-${code}.svg`;
    zip.file(filename, svg);
  });

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);

  const safeName = cromoName.replace(/[^a-zA-Z0-9-_]/g, "_");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${cromoNumber}-${safeName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

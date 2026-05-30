// Codec de la cuadrícula 4×4 ↔ entero de 16 bits con signo (smallint Postgres).
//
// Cubre RN-007: lectura de cuadrículas. Convención:
//   · 16 celdas, lectura por filas (izquierda→derecha, arriba→abajo).
//   · cells[0] = bit de signo (peso -2^15 = -32 768 en complemento a 2).
//   · cells[i] (i>0) = bit (15-i), peso 2^(15-i).
//
// Rango resultante: [-32 768, 32 767] (entero de 16 bits con signo).

export const CELL_COUNT = 16;
export const SMALLINT_MIN = -32768;
export const SMALLINT_MAX = 32767;

/**
 * Convierte la cuadrícula 4×4 (16 celdas booleanas en orden lectura) a un
 * entero de 16 bits con signo (complemento a 2).
 *
 * El input debe tener exactamente 16 elementos; valores fuera de rango o
 * arrays de longitud distinta se tratan como invalid (los faltantes se
 * leen como `false`).
 */
export function computeCode(cells: boolean[]): number {
  let total = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (!cells[i]) continue;
    total += i === 0 ? SMALLINT_MIN : 2 ** (15 - i);
  }
  return total;
}

/**
 * Inversa de `computeCode`: convierte el entero (-32 768..32 767) en
 * array de 16 booleanos en orden lectura (cells[0] = bit de signo).
 */
export function decodeCode(code: number): boolean[] {
  // `& 0xffff` reinterpreta el signed como unsigned 16 bits sin perder
  // información (igual que en src/scripts/generator.js → codeToBits).
  const unsigned = code & 0xffff;
  const out = new Array<boolean>(CELL_COUNT);
  for (let i = 0; i < CELL_COUNT; i++) {
    out[i] = ((unsigned >> (15 - i)) & 1) === 1;
  }
  return out;
}

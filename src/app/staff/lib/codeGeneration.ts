// Lógica pura de selección de codes únicos. Sin Supabase, sin "use server".
//
// Cubre RN-008 (unicidad por categoría) y RN-009 (reserva): el caller pasa
// el conjunto `used` ya consolidado (codes existentes en la categoría +
// codes reservados) y aquí solo seleccionamos N nuevos sin colisión.
//
// El generador acepta un `rng` inyectable para tests deterministas. Por
// defecto es `Math.random` (comportamiento idéntico al previo).

export const SMALLINT_MIN = -32768;
export const SMALLINT_MAX = 32767;
export const SMALLINT_RANGE = SMALLINT_MAX - SMALLINT_MIN + 1; // 65 536

export type Rng = () => number;

/**
 * Rejection-sampling: pinchazos aleatorios en [MIN, MAX] descartando los
 * que ya están en `used`. Eficiente cuando la densidad de ocupación es
 * baja-media; degenera cuando el espacio libre es pequeño.
 *
 * Muta el set `used` (añadiendo cada code seleccionado) para evitar que
 * la misma llamada devuelva duplicados internos.
 */
export function rejectionSample(
  used: Set<number>,
  copies: number,
  rng: Rng = Math.random,
): number[] {
  const codes: number[] = [];
  while (codes.length < copies) {
    const r = Math.floor(rng() * SMALLINT_RANGE) + SMALLINT_MIN;
    if (!used.has(r)) {
      used.add(r);
      codes.push(r);
    }
  }
  return codes;
}

/**
 * Construye el pool de codes libres y aplica Fisher-Yates parcial sobre
 * los `copies` primeros. Coste O(rango) en memoria, pero garantiza que
 * encontremos N codes incluso cuando la densidad es alta (>50%), caso en
 * el que rejection-sampling se volvería costoso.
 */
export function pickFromFreePool(
  used: Set<number>,
  copies: number,
  rng: Rng = Math.random,
): number[] {
  const pool: number[] = [];
  for (let i = SMALLINT_MIN; i <= SMALLINT_MAX; i++) {
    if (!used.has(i)) pool.push(i);
  }
  for (let i = 0; i < copies; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, copies);
}

/**
 * Entrada principal: decide automáticamente qué algoritmo usar según la
 * densidad. <=50% del rango ocupado → rejection-sampling; >50% → pool.
 *
 * Precondición: copies <= free (`SMALLINT_RANGE - used.size`). El caller
 * decide cómo reaccionar si no hay sitio (la action retorna error).
 */
export function pickUniqueCodes(
  used: Set<number>,
  copies: number,
  rng: Rng = Math.random,
): number[] {
  if (copies === 0) return [];
  if (used.size > SMALLINT_RANGE / 2) {
    return pickFromFreePool(used, copies, rng);
  }
  return rejectionSample(used, copies, rng);
}

import { today } from "@internationalized/date";

export const MADRID_TZ = "Europe/Madrid";

// Calculado en servidor y pasado como prop: si se calculara en cliente
// con `new Date().getMonth()` habría desajuste de hidratación (Vercel
// corre en UTC, y a las 00:30 del 1 de febrero en Madrid el servidor
// todavía diría enero).
export function getCurrentMonthInMadrid(): number {
  return today(MADRID_TZ).month;
}

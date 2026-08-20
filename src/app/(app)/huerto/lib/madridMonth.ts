import { today } from "@internationalized/date";

export const MADRID_TZ = "Europe/Madrid";

// Calculado en servidor y pasado como prop: si se calculara en cliente
// con `new Date().getMonth()` habría desajuste de hidratación (Vercel
// corre en UTC, y a las 00:30 del 1 de febrero en Madrid el servidor
// todavía diría enero).
export function getCurrentMonthInMadrid(): number {
  return today(MADRID_TZ).month;
}

// Año por defecto de una entrada nueva del diario. Aquí no hay riesgo de
// hidratación (la ficha de cultivo se monta tras un clic, nunca en SSR),
// pero se calcula igual en la zona del huerto: el 1 de enero a las 00:30
// en Madrid la entrada debe nacer en el año nuevo, no en el anterior.
export function getCurrentYearInMadrid(): number {
  return today(MADRID_TZ).year;
}

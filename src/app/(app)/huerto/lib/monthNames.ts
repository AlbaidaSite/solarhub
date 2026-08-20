const formatter = new Intl.DateTimeFormat("es-ES", { month: "long" });

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// m es 1-12. No se hardcodea un array de doce cadenas: el nombre sale
// de Intl.DateTimeFormat, con la mayúscula inicial aplicada aquí (la
// API lo devuelve en minúsculas: "enero").
export function getMonthName(m: number): string {
  return capitalize(formatter.format(new Date(2000, m - 1, 1)));
}

// Tres primeras letras del nombre completo ("Sep"), no el formato
// "short" de Intl: en es-ES ese devuelve "sept" y las celdas del
// selector de meses quedarían de anchos distintos.
export function getMonthAbbr(m: number): string {
  return getMonthName(m).slice(0, 3);
}

// Nombres de los meses separados por comas, en orden natural y sin
// repetidos: "Enero, Marzo, Octubre". months_of_growth / months_of_harvest
// llegan como array sin orden garantizado, así que se ordena aquí.
// Devuelve "" si no hay ninguno; el llamante decide qué poner en su lugar.
export function formatMonthList(months: number[] | null): string {
  if (months == null) return "";
  return [...new Set(months)]
    .sort((a, b) => a - b)
    .map(getMonthName)
    .join(", ");
}

export function nextMonth(m: number): number {
  return m === 12 ? 1 : m + 1;
}

export function previousMonth(m: number): number {
  return m === 1 ? 12 : m - 1;
}

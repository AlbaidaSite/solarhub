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

export function nextMonth(m: number): number {
  return m === 12 ? 1 : m + 1;
}

export function previousMonth(m: number): number {
  return m === 1 ? 12 : m - 1;
}

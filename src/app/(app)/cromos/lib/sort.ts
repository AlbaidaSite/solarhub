import type { CromoDetail, SortBy } from "@/types/cromo";

// Reglas de orden, definidas en una sola pieza para que el álbum y la
// navegación entre cromos en el modal compartan la misma lógica:
//   number       → Categoría(Asc) > Número(Asc) [+ variante para estabilidad]
//   rarity_asc   → Rareza(Asc)  > Categoría(Asc) > Número(Asc)
//   rarity_desc  → Rareza(Desc) > Categoría(Asc) > Número(Asc)
//   name_asc     → Nombre(Asc)
//   name_desc    → Nombre(Desc)
//
// Categoría se ordena por `order_number`; rareza por su `id`.
export function compareCromos(
  a: CromoDetail,
  b: CromoDetail,
  sortBy: SortBy,
): number {
  const catOf = (c: CromoDetail) =>
    c.category?.order_number ?? Number.POSITIVE_INFINITY;
  const rarOf = (c: CromoDetail) =>
    c.rarity?.id ?? Number.POSITIVE_INFINITY;
  const byCatNumber = (): number => {
    const ca = catOf(a);
    const cb = catOf(b);
    if (ca !== cb) return ca - cb;
    if (a.number !== b.number) return a.number - b.number;
    return a.variant - b.variant;
  };

  switch (sortBy) {
    case "number":
      return byCatNumber();
    case "rarity_asc": {
      const diff = rarOf(a) - rarOf(b);
      return diff !== 0 ? diff : byCatNumber();
    }
    case "rarity_desc": {
      const diff = rarOf(b) - rarOf(a);
      return diff !== 0 ? diff : byCatNumber();
    }
    case "name_asc": {
      const cmp = a.name.localeCompare(b.name, "es");
      return cmp !== 0 ? cmp : a.variant - b.variant;
    }
    case "name_desc": {
      const cmp = b.name.localeCompare(a.name, "es");
      return cmp !== 0 ? cmp : a.variant - b.variant;
    }
  }
}

// Sort por defecto (idéntico a "Ordenar por número" en el dropdown):
// es el que usa el álbum cuando no se ha tocado el selector y el que
// usa el modal para calcular prev/next.
export function sortCromosDefault(cromos: CromoDetail[]): CromoDetail[] {
  return [...cromos].sort((a, b) => compareCromos(a, b, "number"));
}

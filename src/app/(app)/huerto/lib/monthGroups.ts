import type { Plant } from "@/types/garden";

export interface MonthGroups {
  siembra: Plant[];
  recogida: Plant[];
  otros: Plant[];
}

function sortByName(plants: Plant[]): Plant[] {
  return [...plants].sort((a, b) =>
    a.name.localeCompare(b.name, "es-ES", { sensitivity: "base" }),
  );
}

// m es el mes seleccionado (1-12). Una planta sembrada y recogida el
// mismo mes aparece en siembra y recogida a la vez, nunca en otros.
// Arrays null se tratan como sin meses declarados ('{}').
export function monthGroups(plants: Plant[], m: number): MonthGroups {
  const siembra: Plant[] = [];
  const recogida: Plant[] = [];
  const otros: Plant[] = [];

  for (const plant of plants) {
    const growth = plant.months_of_growth ?? [];
    const harvest = plant.months_of_harvest ?? [];
    const sows = growth.includes(m);
    const harvests = harvest.includes(m);

    if (sows) siembra.push(plant);
    if (harvests) recogida.push(plant);
    if (!sows && !harvests) otros.push(plant);
  }

  return {
    siembra: sortByName(siembra),
    recogida: sortByName(recogida),
    otros: sortByName(otros),
  };
}

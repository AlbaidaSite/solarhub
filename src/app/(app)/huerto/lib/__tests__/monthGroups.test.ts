import { describe, it, expect } from "vitest";
import { monthGroups } from "../monthGroups";
import type { Plant } from "@/types/garden";

function plant(overrides: Partial<Plant> & { id: number; name: string }): Plant {
  return {
    icon_path: "huerto/x.webp",
    seed_info: null,
    harvest_info: null,
    months_of_growth: null,
    months_of_harvest: null,
    color: null,
    ...overrides,
  };
}

describe("monthGroups", () => {
  it("arrays null se tratan como sin meses declarados", () => {
    const p = plant({ id: 1, name: "Ñora" });
    const groups = monthGroups([p], 6);
    expect(groups.otros).toEqual([p]);
    expect(groups.siembra).toEqual([]);
    expect(groups.recogida).toEqual([]);
  });

  it("una planta sembrada y recogida el mismo mes sale en ambos grupos, no en otros", () => {
    const p = plant({
      id: 1,
      name: "Rabanito",
      months_of_growth: [3],
      months_of_harvest: [3],
    });
    const groups = monthGroups([p], 3);
    expect(groups.siembra).toEqual([p]);
    expect(groups.recogida).toEqual([p]);
    expect(groups.otros).toEqual([]);
  });

  it("un mes sin actividad deja todo en otros", () => {
    const p = plant({ id: 1, name: "Tomate", months_of_growth: [4], months_of_harvest: [8] });
    const groups = monthGroups([p], 12);
    expect(groups.otros).toEqual([p]);
  });

  it("meses frontera 1 y 12", () => {
    const enero = plant({ id: 1, name: "Ajo", months_of_growth: [1] });
    const diciembre = plant({ id: 2, name: "Puerro", months_of_growth: [12] });
    expect(monthGroups([enero, diciembre], 1).siembra).toEqual([enero]);
    expect(monthGroups([enero, diciembre], 12).siembra).toEqual([diciembre]);
  });

  it("ordena alfabéticamente con acentos y eñe (es-ES, sensitivity base)", () => {
    // En la colación española, Ñ ordena después de N y antes de O: Nabo,
    // Nuez, Ñora — no alfabético ASCII puro.
    const nora = plant({ id: 1, name: "Ñora", months_of_growth: [5] });
    const nabo = plant({ id: 2, name: "Nabo", months_of_growth: [5] });
    const nuez = plant({ id: 3, name: "Nuez", months_of_growth: [5] });
    expect(monthGroups([nora, nabo, nuez], 5).siembra).toEqual([nabo, nuez, nora]);
  });
});

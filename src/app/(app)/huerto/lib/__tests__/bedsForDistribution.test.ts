import { describe, it, expect } from "vitest";
import { bedsForDistribution } from "../bedsForDistribution";
import type { PlantBed } from "@/types/garden";

function pb(overrides: Partial<PlantBed> & { id: number }): PlantBed {
  return {
    plant_id: null,
    garden_bed_id: 1,
    description: null,
    is_future: false,
    ...overrides,
  };
}

describe("bedsForDistribution", () => {
  it("modo actual solo incluye filas con is_future = false", () => {
    const rows = [
      pb({ id: 1, garden_bed_id: 1, is_future: false }),
      pb({ id: 2, garden_bed_id: 1, is_future: true }),
    ];
    expect(bedsForDistribution(rows, "actual").get(1)).toEqual([rows[0]]);
  });

  it("modo planificada solo incluye filas con is_future = true", () => {
    const rows = [
      pb({ id: 1, garden_bed_id: 1, is_future: false }),
      pb({ id: 2, garden_bed_id: 1, is_future: true }),
    ];
    expect(bedsForDistribution(rows, "planificada").get(1)).toEqual([rows[1]]);
  });

  it("agrupa por garden_bed_id", () => {
    const rows = [
      pb({ id: 1, garden_bed_id: 1 }),
      pb({ id: 2, garden_bed_id: 2 }),
      pb({ id: 3, garden_bed_id: 1 }),
    ];
    const distribution = bedsForDistribution(rows, "actual");
    expect(distribution.get(1)).toEqual([rows[0], rows[2]]);
    expect(distribution.get(2)).toEqual([rows[1]]);
  });

  it("un bancal sin filas en el modo activo no aparece en el Map", () => {
    const rows = [pb({ id: 1, garden_bed_id: 1, is_future: false })];
    expect(bedsForDistribution(rows, "planificada").has(1)).toBe(false);
  });

  it("entrada vacía produce un Map vacío", () => {
    expect(bedsForDistribution([], "actual").size).toBe(0);
  });

  it("bancal con cultivo actual y futuro distinto: una fila en cada modo", () => {
    const rows = [
      pb({ id: 1, garden_bed_id: 5, plant_id: 10, is_future: false }),
      pb({ id: 2, garden_bed_id: 5, plant_id: 20, is_future: true }),
    ];
    expect(bedsForDistribution(rows, "actual").get(5)).toEqual([rows[0]]);
    expect(bedsForDistribution(rows, "planificada").get(5)).toEqual([rows[1]]);
  });
});

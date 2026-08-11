// SUT: src/app/(app)/huerto/actions.ts → getGardenDataAction

import { describe, it, expect, vi } from "vitest";
import { createSupabaseStub } from "../fixtures/supabaseMock";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGardenDataAction } from "@/app/(app)/huerto/actions";

const plantRow = {
  id: 1,
  name: "Ajo",
  icon_path: "huerto/ajo.webp",
  seed_info: null,
  harvest_info: null,
  months_of_growth: [10, 11],
  months_of_harvest: [5, 6],
};

const bedRow = { id: 1, name: "Bancal 1", width: 15, height: 10, pos_x: 5, pos_y: 5 };

const plantBedRow = {
  id: 1,
  plant_id: 1,
  garden_bed_id: 1,
  description: null,
  is_future: false,
};

describe("getGardenDataAction", () => {
  it("consulta plant, garden_bed y plant_bed y resuelve icon_path a URL pública", async () => {
    const stub = createSupabaseStub({
      from: {
        plant: { data: [plantRow], error: null },
        garden_bed: { data: [bedRow], error: null },
        plant_bed: { data: [plantBedRow], error: null },
      },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client as never);

    const result = await getGardenDataAction();

    const queriedTables = stub.calls.from.map((c) => c.table);
    expect(queriedTables).toEqual(expect.arrayContaining(["plant", "garden_bed", "plant_bed"]));

    expect(result.plants).toHaveLength(1);
    expect(result.plants[0].icon_path).not.toBe(plantRow.icon_path);
    expect(result.plants[0].icon_path).toContain(plantRow.icon_path);
    expect(result.beds).toEqual([bedRow]);
    expect(result.plantBeds).toEqual([plantBedRow]);
  });

  it("normaliza months_of_growth/harvest a number[] aunque lleguen como strings", async () => {
    const stringMonthsRow = {
      ...plantRow,
      months_of_growth: ["10", "11"],
      months_of_harvest: ["5", "6"],
    };
    const stub = createSupabaseStub({
      from: {
        plant: { data: [stringMonthsRow], error: null },
        garden_bed: { data: [bedRow], error: null },
        plant_bed: { data: [plantBedRow], error: null },
      },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client as never);

    const result = await getGardenDataAction();

    expect(result.plants[0].months_of_growth).toEqual([10, 11]);
    expect(result.plants[0].months_of_harvest).toEqual([5, 6]);
  });

  it("un error en cualquier tabla devuelve arrays vacíos en vez de lanzar", async () => {
    const stub = createSupabaseStub({
      from: {
        plant: { data: null, error: { message: "boom" } },
        garden_bed: { data: [bedRow], error: null },
        plant_bed: { data: [], error: null },
      },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client as never);

    const result = await getGardenDataAction();

    expect(result.plants).toEqual([]);
    expect(result.beds).toEqual([bedRow]);
  });
});

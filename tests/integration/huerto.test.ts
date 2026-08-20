// SUT: src/app/(app)/huerto/actions.ts → getGardenDataAction

import { describe, it, expect, vi } from "vitest";
import { createSupabaseStub } from "../fixtures/supabaseMock";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addPlantBedAction, getGardenDataAction } from "@/app/(app)/huerto/actions";

const plantRow = {
  id: 1,
  name: "Ajo",
  icon_path: "huerto/ajo.webp",
  seed_info: null,
  harvest_info: null,
  months_of_growth: [10, 11],
  months_of_harvest: [5, 6],
  color: "olive-400",
};

const bedRow = { id: 1, name: "Bancal 1", width: 15, height: 10, pos_x: 5, pos_y: 5 };

const plantBedRow = {
  id: 1,
  plant_id: 1,
  garden_bed_id: 1,
  description: null,
  is_future: false,
  order_number: 0,
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

describe("addPlantBedAction", () => {
  // Bancal ancho de 180: admite hasta 3 cultivos (60 cada uno) y rechaza
  // el cuarto, que dejaría subceldas de 45 (< MIN_SUBCELL_SIZE).
  const wideBed = { id: 7, name: "Bancal ancho", width: 180, height: 80, pos_x: 0, pos_y: 0 };

  function occupied(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      ...plantBedRow,
      id: i + 1,
      garden_bed_id: wideBed.id,
      order_number: i,
    }));
  }

  it("sin permiso de edición no toca la base de datos", async () => {
    const stub = createSupabaseStub({
      authUserId: "u-1",
      rpc: { is_garden_manager: { data: false, error: null }, is_staff: { data: false, error: null } },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client as never);

    const result = await addPlantBedAction({
      gardenBedId: wideBed.id,
      plantId: 1,
      description: null,
      isFuture: false,
      index: 0,
    });

    expect(result).toEqual({ ok: false, error: expect.stringContaining("permiso") });
    expect(stub.calls.from).toHaveLength(0);
  });

  it("rechaza el cultivo que dejaría las divisiones por debajo del mínimo", async () => {
    const stub = createSupabaseStub({
      authUserId: "u-1",
      rpc: { is_garden_manager: { data: true, error: null }, is_staff: { data: false, error: null } },
      from: {
        garden_bed: { data: wideBed, error: null },
        plant_bed: { data: occupied(3), error: null },
      },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client as never);

    const result = await addPlantBedAction({
      gardenBedId: wideBed.id,
      plantId: 1,
      description: null,
      isFuture: false,
      index: 0,
    });

    expect(result.ok).toBe(false);
    // Se consultó el bancal y sus cultivos, pero no se llegó a insertar.
    expect(stub.calls.from.some((c) => c.chain.includes("insert"))).toBe(false);
  });

  it("inserta en la posición pedida y guarda el tipo sin espacios sobrantes", async () => {
    const existing = occupied(1);
    const inserted = {
      ...plantBedRow,
      id: 99,
      garden_bed_id: wideBed.id,
      description: "Cherry",
      order_number: 0,
    };
    const stub = createSupabaseStub({
      authUserId: "u-1",
      rpc: { is_garden_manager: { data: true, error: null }, is_staff: { data: false, error: null } },
      from: {
        garden_bed: { data: wideBed, error: null },
        plant_bed: {
          // 1) filas actuales  2) la insertada  3) el update del renumerado
          // 4) la lectura final que se devuelve al cliente.
          default: { data: [inserted, { ...existing[0], order_number: 1 }], error: null },
          queue: [
            { data: existing, error: null },
            { data: inserted, error: null },
          ],
        },
      },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client as never);

    const result = await addPlantBedAction({
      gardenBedId: wideBed.id,
      plantId: 1,
      description: "  Cherry  ",
      isFuture: false,
      index: 0,
    });

    expect(result.ok).toBe(true);

    const insertCall = stub.calls.from.find((c) => c.chain.includes("insert"));
    expect(insertCall?.args[0][0]).toMatchObject({
      garden_bed_id: wideBed.id,
      plant_id: 1,
      description: "Cherry",
      is_future: false,
      order_number: 0,
    });

    // El cultivo que ya estaba pasa de la posición 0 a la 1.
    const updateCall = stub.calls.from.find((c) => c.chain.includes("update"));
    expect(updateCall?.args[0][0]).toEqual({ order_number: 1 });
  });
});

import { describe, it, expect } from "vitest";
import { cycleYear, diaryYears, entriesForYear } from "../diary";
import type { CropDiaryEntry } from "@/types/garden";

function entry(id: number, sowYear: number): CropDiaryEntry {
  return {
    id,
    plant_id: 1,
    sow_year: sowYear,
    notes: `Notas ${id}`,
    updated_at: "2026-05-01T10:00:00Z",
  };
}

describe("diaryYears", () => {
  it("da los años con entradas, del más reciente al más antiguo y sin repetir", () => {
    expect(diaryYears([entry(1, 2024), entry(2, 2026), entry(3, 2024)])).toEqual([2026, 2024]);
  });

  it("sin entradas no hay años por los que navegar", () => {
    expect(diaryYears([])).toEqual([]);
  });
});

describe("entriesForYear", () => {
  it("un año puede tener varias entradas y salen todas", () => {
    const entries = [entry(1, 2026), entry(2, 2024), entry(3, 2026)];
    expect(entriesForYear(entries, 2026).map((e) => e.id)).toEqual([1, 3]);
  });
});

describe("cycleYear", () => {
  const years = [2026, 2024, 2021];

  it("avanza y retrocede por la lista", () => {
    expect(cycleYear(years, 2026, 1)).toBe(2024);
    expect(cycleYear(years, 2024, -1)).toBe(2026);
  });

  // Igual que los meses del panel de cultivos: por los extremos se da la
  // vuelta en vez de quedarse encallado.
  it("da la vuelta por los dos extremos", () => {
    expect(cycleYear(years, 2021, 1)).toBe(2026);
    expect(cycleYear(years, 2026, -1)).toBe(2021);
  });

  it("con un solo año se queda donde está", () => {
    expect(cycleYear([2026], 2026, 1)).toBe(2026);
    expect(cycleYear([2026], 2026, -1)).toBe(2026);
  });

  it("si el año actual ya no tiene entradas se cae al más reciente", () => {
    expect(cycleYear(years, 1999, 1)).toBe(2026);
  });

  it("sin años devuelve el que había, no undefined", () => {
    expect(cycleYear([], 2026, 1)).toBe(2026);
  });
});

// @vitest-environment jsdom
// SUT: src/app/(app)/huerto/components/GardenCanvas.tsx

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import GardenCanvas from "@/app/(app)/huerto/components/GardenCanvas";
import type { GardenBed, Plant, PlantBed } from "@/types/garden";

beforeEach(() => {
  cleanup();
});

const beds: GardenBed[] = [
  { id: 1, name: "Vacío", width: 10, height: 10, pos_x: 0, pos_y: 0 },
  { id: 2, name: "Con dos cultivos", width: 20, height: 10, pos_x: 20, pos_y: 0 },
];

const plants: Plant[] = [
  { id: 1, name: "Ajo", icon_path: "ajo.webp", seed_info: null, harvest_info: null, months_of_growth: null, months_of_harvest: null },
  { id: 2, name: "Tomate", icon_path: "tomate.webp", seed_info: null, harvest_info: null, months_of_growth: null, months_of_harvest: null },
];

const plantsById = new Map(plants.map((p) => [p.id, p]));

function pb(overrides: Partial<PlantBed> & { id: number; garden_bed_id: number }): PlantBed {
  return { plant_id: null, description: null, is_future: false, ...overrides };
}

describe("GardenCanvas", () => {
  it("dibuja un <rect> de contorno por bancal", () => {
    const distribution = new Map<number, PlantBed[]>();
    const { container } = render(
      <GardenCanvas beds={beds} distribution={distribution} plantsById={plantsById} mode="actual" />,
    );
    // Marco del lienzo + un rect de contorno por bancal.
    expect(container.querySelectorAll("svg > rect, svg > g > rect")).toHaveLength(1 + beds.length);
  });

  it("un bancal ocupado dibuja tantas <image> como cultivos tiene", () => {
    const distribution = new Map<number, PlantBed[]>([
      [2, [pb({ id: 1, garden_bed_id: 2, plant_id: 1 }), pb({ id: 2, garden_bed_id: 2, plant_id: 2 })]],
    ]);
    const { container } = render(
      <GardenCanvas beds={beds} distribution={distribution} plantsById={plantsById} mode="actual" />,
    );
    expect(container.querySelectorAll("image")).toHaveLength(2);
  });

  it("un bancal vacío no renderiza ninguna <image>", () => {
    const distribution = new Map<number, PlantBed[]>();
    const { container } = render(
      <GardenCanvas beds={beds} distribution={distribution} plantsById={plantsById} mode="actual" />,
    );
    expect(container.querySelectorAll("image")).toHaveLength(0);
  });

  it("no hay ningún <img> HTML dentro del <svg>", () => {
    const distribution = new Map<number, PlantBed[]>([
      [2, [pb({ id: 1, garden_bed_id: 2, plant_id: 1 })]],
    ]);
    const { container } = render(
      <GardenCanvas beds={beds} distribution={distribution} plantsById={plantsById} mode="actual" />,
    );
    expect(container.querySelector("svg img")).toBeNull();
  });
});

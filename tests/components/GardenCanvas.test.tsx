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
  { id: 1, name: "Ajo", icon_path: "ajo.webp", seed_info: null, harvest_info: null, months_of_growth: null, months_of_harvest: null, color: "lime-600" },
  { id: 2, name: "Tomate", icon_path: "tomate.webp", seed_info: null, harvest_info: null, months_of_growth: null, months_of_harvest: null, color: "red-700" },
];

const plantsById = new Map(plants.map((p) => [p.id, p]));

function pb(overrides: Partial<PlantBed> & { id: number; garden_bed_id: number }): PlantBed {
  return { plant_id: null, description: null, is_future: false, order_number: 0, ...overrides };
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

  it("cada cultivo se pinta con el color de su planta y relleno translúcido", () => {
    const distribution = new Map<number, PlantBed[]>([
      [2, [pb({ id: 1, garden_bed_id: 2, plant_id: 2 })]],
    ]);
    const { container } = render(
      <GardenCanvas beds={beds} distribution={distribution} plantsById={plantsById} mode="actual" />,
    );

    const polygon = container.querySelector("polygon");
    expect(polygon?.parentElement).toHaveClass("text-red-700");
    // El color sale de currentColor (la clase text-* de la planta) y el
    // relleno es translúcido para que se vea el lienzo por debajo. El
    // valor exacto es una decisión de diseño que se retoca a ojo, así que
    // aquí solo se fija que sea translúcido, no cuánto.
    expect(polygon).toHaveAttribute("fill", "currentColor");
    const fillOpacity = Number(polygon?.getAttribute("fill-opacity"));
    expect(fillOpacity).toBeGreaterThan(0);
    expect(fillOpacity).toBeLessThan(1);
  });

  it("sin onBedSelect el lienzo es una imagen y ningún bancal es enfocable", () => {
    const { container } = render(
      <GardenCanvas
        beds={beds}
        distribution={new Map()}
        plantsById={plantsById}
        mode="actual"
      />,
    );
    expect(container.querySelector("svg")).toHaveAttribute("role", "img");
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);
  });

  it("con onBedSelect cada bancal es un botón que avisa de su id", () => {
    const selected: number[] = [];
    const { container } = render(
      <GardenCanvas
        beds={beds}
        distribution={new Map()}
        plantsById={plantsById}
        mode="actual"
        onBedSelect={(id) => selected.push(id)}
      />,
    );

    const buttons = container.querySelectorAll('g[role="button"]');
    expect(buttons).toHaveLength(beds.length);

    (buttons[1] as SVGGElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(selected).toEqual([2]);
  });

  it("la previsualización añade una subcelda de más solo en su bancal", () => {
    const distribution = new Map<number, PlantBed[]>([
      [2, [pb({ id: 1, garden_bed_id: 2, plant_id: 1 })]],
    ]);
    const { container } = render(
      <GardenCanvas
        beds={beds}
        distribution={distribution}
        plantsById={plantsById}
        mode="actual"
        preview={{ bedId: 2, plant: plants[1], index: 0 }}
      />,
    );

    // El cultivo existente + el fantasma.
    expect(container.querySelectorAll("polygon")).toHaveLength(2);
    // El fantasma va primero (index 0) y se dibuja más apagado.
    const [ghost, existing] = Array.from(container.querySelectorAll("polygon"));
    expect(Number(ghost.getAttribute("fill-opacity"))).toBeLessThan(
      Number(existing.getAttribute("fill-opacity")),
    );
  });
});

// @vitest-environment jsdom
// SUT: src/app/(app)/huerto/components/HuertoView.tsx

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />;
  },
}));

import HuertoView from "@/app/(app)/huerto/components/HuertoView";
import { HUERTO_TAB_IDS } from "@/app/(app)/huerto/components/HuertoTabs";
import type { GardenBed, Plant, PlantBed } from "@/types/garden";

const beds: GardenBed[] = [{ id: 1, name: "Bancal", width: 10, height: 10, pos_x: 0, pos_y: 0 }];

const plants: Plant[] = [
  { id: 1, name: "Ajo", icon_path: "ajo.webp", seed_info: null, harvest_info: null, months_of_growth: [1], months_of_harvest: null },
  { id: 2, name: "Sandía", icon_path: "sandia.webp", seed_info: null, harvest_info: null, months_of_growth: [6], months_of_harvest: null },
];

const plantBeds: PlantBed[] = [
  { id: 1, plant_id: 1, garden_bed_id: 1, description: null, is_future: false },
  { id: 2, plant_id: 2, garden_bed_id: 1, description: null, is_future: true },
];

beforeEach(() => {
  cleanup();
});

describe("HuertoView", () => {
  it("al montar se muestra la distribución Actual", () => {
    const { container } = render(
      <HuertoView plants={plants} beds={beds} plantBeds={plantBeds} initialMonth={1} />,
    );
    expect(container.querySelectorAll("image")).toHaveLength(1);
  });

  it("pulsar Planificar cambia los bancales dibujados", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HuertoView plants={plants} beds={beds} plantBeds={plantBeds} initialMonth={1} />,
    );
    await user.click(screen.getByRole("button", { name: "Planificar" }));
    // Ajo (actual) desaparece del lienzo, Sandía (futuro) aparece: sigue
    // habiendo exactamente un <image>, pero es el cultivo futuro.
    expect(container.querySelectorAll("image")).toHaveLength(1);
  });

  it("cambiar de mes recompone las tres listas sin pedir datos de red", async () => {
    const user = userEvent.setup();
    render(<HuertoView plants={plants} beds={beds} plantBeds={plantBeds} initialMonth={1} />);

    const siembraSection = screen.getByText("Siembra:").closest("section")!;
    expect(within(siembraSection).getByRole("img", { name: "Ajo" })).toBeInTheDocument();
    expect(within(siembraSection).queryByRole("img", { name: "Sandía" })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Mes" }), "6");

    expect(within(siembraSection).queryByRole("img", { name: "Ajo" })).not.toBeInTheDocument();
    expect(within(siembraSection).getByRole("img", { name: "Sandía" })).toBeInTheDocument();
  });

  it("en móvil, la pestaña no activa no está en el árbol accesible", () => {
    render(<HuertoView plants={plants} beds={beds} plantBeds={plantBeds} initialMonth={1} />);
    const cultivosPanel = document.getElementById(HUERTO_TAB_IDS.cultivosPanel);
    const bancalPanel = document.getElementById(HUERTO_TAB_IDS.bancalPanel);
    expect(cultivosPanel).toHaveClass("hidden");
    expect(bancalPanel).not.toHaveClass("hidden");
  });
});

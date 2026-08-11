// @vitest-environment jsdom
// SUT: src/app/(app)/huerto/components/CropPanel.tsx

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />;
  },
}));

import CropPanel from "@/app/(app)/huerto/components/CropPanel";
import type { Plant } from "@/types/garden";

function plant(overrides: Partial<Plant> & { id: number; name: string }): Plant {
  return {
    icon_path: "x.webp",
    seed_info: null,
    harvest_info: null,
    months_of_growth: null,
    months_of_harvest: null,
    ...overrides,
  };
}

beforeEach(() => {
  cleanup();
});

describe("CropPanel", () => {
  it("reparte las plantas en las tres secciones según el mes", () => {
    const plants = [
      plant({ id: 1, name: "Ajo", months_of_growth: [1] }),
      plant({ id: 2, name: "Sandía", months_of_harvest: [1] }),
      plant({ id: 3, name: "Tomate", months_of_growth: [6] }),
    ];
    render(<CropPanel plants={plants} month={1} onMonthChange={() => {}} />);
    expect(screen.getByRole("img", { name: "Ajo" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Sandía" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Tomate" })).toBeInTheDocument();
  });

  it("un mes sin actividad muestra el estado vacío en las tres secciones", () => {
    const plants = [plant({ id: 1, name: "Ajo", months_of_growth: [1], months_of_harvest: [6] })];
    render(<CropPanel plants={plants} month={12} onMonthChange={() => {}} />);
    expect(screen.getAllByText("Ninguno")).toHaveLength(2); // Siembra y Recogida vacías; Otros tiene a Ajo.
    expect(screen.getByRole("img", { name: "Ajo" })).toBeInTheDocument();
  });

  it("las cabeceras se muestran siempre, incluso sin ninguna planta en el sistema", () => {
    render(<CropPanel plants={[]} month={1} onMonthChange={() => {}} />);
    expect(screen.getByText(/no hay plantas registradas/i)).toBeInTheDocument();
  });
});

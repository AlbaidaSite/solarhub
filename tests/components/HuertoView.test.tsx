// @vitest-environment jsdom
// SUT: src/app/(app)/huerto/components/HuertoView.tsx

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />;
  },
}));

// HuertoView pregunta al servidor si el usuario puede editar el huerto en
// cuanto monta. Por defecto se responde que no: es el caso de la mayoría
// de usuarios y deja la vista igual que antes de esta funcionalidad.
const getGardenPermissionAction = vi.fn(async () => ({ canManage: false }));

vi.mock("@/app/(app)/huerto/actions", () => ({
  getGardenPermissionAction: () => getGardenPermissionAction(),
  addPlantBedAction: vi.fn(),
  updatePlantBedAction: vi.fn(),
  deletePlantBedAction: vi.fn(),
  reorderPlantBedsAction: vi.fn(),
}));

import HuertoView from "@/app/(app)/huerto/components/HuertoView";
import { HUERTO_TAB_IDS } from "@/app/(app)/huerto/components/HuertoTabs";
import type { GardenBed, Plant, PlantBed } from "@/types/garden";

const beds: GardenBed[] = [{ id: 1, name: "Bancal", width: 100, height: 100, pos_x: 0, pos_y: 0 }];

const plants: Plant[] = [
  { id: 1, name: "Ajo", icon_path: "ajo.webp", seed_info: null, harvest_info: null, months_of_growth: [1], months_of_harvest: null, color: "lime-600" },
  { id: 2, name: "Sandía", icon_path: "sandia.webp", seed_info: null, harvest_info: null, months_of_growth: [6], months_of_harvest: null, color: "rose-700" },
];

const plantBeds: PlantBed[] = [
  { id: 1, plant_id: 1, garden_bed_id: 1, description: null, is_future: false, order_number: 0 },
  { id: 2, plant_id: 2, garden_bed_id: 1, description: null, is_future: true, order_number: 0 },
];

beforeEach(() => {
  cleanup();
  getGardenPermissionAction.mockResolvedValue({ canManage: false });
  // useIsMobile (arrastre solo en escritorio) consulta matchMedia, que
  // jsdom no implementa. Se responde "no coincide" = escritorio.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
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

  // Consultar qué hay plantado en un bancal es para todo el mundo; lo que
  // depende del permiso es lo que se puede tocar una vez abierto.
  it("sin permiso de edición los bancales se abren igual, pero sin nada que editar", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HuertoView plants={plants} beds={beds} plantBeds={plantBeds} initialMonth={1} />,
    );
    await waitFor(() => expect(getGardenPermissionAction).toHaveBeenCalled());

    const bedButton = container.querySelector('g[role="button"]');
    expect(bedButton).not.toBeNull();

    await user.click(bedButton as SVGGElement);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Ajo")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Añadir cultivo/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Vaciar Bancal" })).not.toBeInTheDocument();
  });

  it("con permiso, pulsar un bancal abre su modal con los cultivos que tiene", async () => {
    getGardenPermissionAction.mockResolvedValue({ canManage: true });
    const user = userEvent.setup();
    const { container } = render(
      <HuertoView plants={plants} beds={beds} plantBeds={plantBeds} initialMonth={1} />,
    );

    const bedButton = await waitFor(() => {
      const found = container.querySelector('g[role="button"]');
      expect(found).not.toBeNull();
      return found as SVGGElement;
    });

    await user.click(bedButton);

    const dialog = await screen.findByRole("dialog");
    // Sin título visible, el bancal se identifica por el nombre accesible.
    expect(dialog).toHaveAccessibleName("Bancal");
    expect(within(dialog).getByRole("button", { name: /Añadir cultivo/ })).toBeInTheDocument();
    expect(within(dialog).getByText("Ajo")).toBeInTheDocument();
  });
});

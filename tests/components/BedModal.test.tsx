// @vitest-environment jsdom
// SUT: src/app/(app)/huerto/components/BedModal.tsx

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

const addPlantBedAction = vi.fn();
const updatePlantBedAction = vi.fn();
const deletePlantBedAction = vi.fn();
const reorderPlantBedsAction = vi.fn();

vi.mock("@/app/(app)/huerto/actions", () => ({
  addPlantBedAction: (input: unknown) => addPlantBedAction(input),
  updatePlantBedAction: (input: unknown) => updatePlantBedAction(input),
  deletePlantBedAction: (id: number) => deletePlantBedAction(id),
  reorderPlantBedsAction: (input: unknown) => reorderPlantBedsAction(input),
}));

import BedModal from "@/app/(app)/huerto/components/BedModal";
import type { GardenBed, Plant, PlantBed } from "@/types/garden";

const plants: Plant[] = [
  { id: 1, name: "Tomate", icon_path: "tomate.webp", seed_info: null, harvest_info: null, months_of_growth: [3], months_of_harvest: null, color: "red-700" },
  { id: 2, name: "Lechuga", icon_path: "lechuga.webp", seed_info: null, harvest_info: null, months_of_growth: [9], months_of_harvest: null, color: "lime-600" },
];
const plantsById = new Map(plants.map((p) => [p.id, p]));

// 180 de ancho: caben 3 cultivos (60 cada uno), el cuarto no.
const wideBed: GardenBed = { id: 7, name: "Bancal ancho", width: 180, height: 80, pos_x: 0, pos_y: 0 };

function row(overrides: Partial<PlantBed> & { id: number }): PlantBed {
  return {
    plant_id: 1,
    garden_bed_id: wideBed.id,
    description: null,
    is_future: false,
    order_number: 0,
    ...overrides,
  };
}

function renderModal(props: Partial<React.ComponentProps<typeof BedModal>> = {}) {
  const onRowsChange = vi.fn();
  const onRowDeleted = vi.fn();
  const onClose = vi.fn();

  render(
    <BedModal
      bed={wideBed}
      rows={[row({ id: 1 })]}
      plants={plants}
      plantsById={plantsById}
      month={3}
      isFuture={false}
      onClose={onClose}
      onRowsChange={onRowsChange}
      onRowDeleted={onRowDeleted}
      {...props}
    />,
  );

  return { onRowsChange, onRowDeleted, onClose };
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("BedModal — listado", () => {
  it("muestra el botón de añadir y un cultivo por fila", () => {
    renderModal({ rows: [row({ id: 1 }), row({ id: 2, plant_id: 2, order_number: 1 })] });

    expect(screen.getByRole("button", { name: /Añadir cultivo/ })).toBeEnabled();
    expect(screen.getByText("Tomate")).toBeInTheDocument();
    expect(screen.getByText("Lechuga")).toBeInTheDocument();
  });

  // El modal no tiene título visible, así que el nombre del bancal solo
  // llega por el nombre accesible del diálogo: sin esto se anunciaría
  // como "diálogo" a secas y no habría forma de saber qué bancal es.
  it("el diálogo se llama como el bancal, y como la acción al abrir el formulario", async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.getByRole("dialog")).toHaveAccessibleName("Bancal ancho");

    await user.click(screen.getByRole("button", { name: /Añadir cultivo/ }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Añadir cultivo");
  });

  it("el tipo se muestra bajo el nombre del cultivo", () => {
    renderModal({ rows: [row({ id: 1, description: "Cherry" })] });
    expect(screen.getByText("Cherry")).toBeInTheDocument();
  });

  it("con un solo cultivo no hay botón de mover", () => {
    renderModal();
    expect(screen.queryByRole("button", { name: "Mover cultivo" })).not.toBeInTheDocument();
  });

  it("con dos o más cultivos cada fila puede moverse", () => {
    renderModal({ rows: [row({ id: 1 }), row({ id: 2, order_number: 1 })] });
    expect(screen.getAllByRole("button", { name: "Mover cultivo" })).toHaveLength(2);
  });

  it("un bancal lleno no deja añadir y explica por qué", () => {
    renderModal({
      rows: [row({ id: 1 }), row({ id: 2, order_number: 1 }), row({ id: 3, order_number: 2 })],
    });

    const add = screen.getByRole("button", { name: /Añadir cultivo/ });
    expect(add).toBeDisabled();
    expect(add).toHaveAttribute("title", expect.stringContaining("demasiado pequeñas"));
  });

  it("un bancal vacío lo dice", () => {
    renderModal({ rows: [] });
    expect(screen.getByText("Este bancal está vacío.")).toBeInTheDocument();
  });
});

describe("BedModal — alta y edición", () => {
  it("añadir manda el cultivo al final del bancal en el modo que se está viendo", async () => {
    const user = userEvent.setup();
    addPlantBedAction.mockResolvedValue({ ok: true, rows: [] });
    const { onRowsChange } = renderModal({ isFuture: true });

    await user.click(screen.getByRole("button", { name: /Añadir cultivo/ }));
    await user.selectOptions(screen.getByRole("combobox", { name: /Cultivo/ }), "2");
    await user.type(screen.getByRole("textbox", { name: /Tipo/ }), "  Romana  ");
    await user.click(screen.getByRole("button", { name: "Añadir" }));

    await waitFor(() => expect(addPlantBedAction).toHaveBeenCalledOnce());
    expect(addPlantBedAction).toHaveBeenCalledWith({
      gardenBedId: wideBed.id,
      plantId: 2,
      description: "Romana",
      isFuture: true,
      index: 1,
    });
    expect(onRowsChange).toHaveBeenCalled();
  });

  it("el desplegable pone primero lo que se siembra en el mes elegido", async () => {
    const user = userEvent.setup();
    renderModal({ month: 9 });

    await user.click(screen.getByRole("button", { name: /Añadir cultivo/ }));

    const groups = screen
      .getByRole("combobox", { name: /Cultivo/ })
      .querySelectorAll("optgroup");
    expect(groups[0]).toHaveAttribute("label", expect.stringContaining("septiembre"));
    expect(within(groups[0] as HTMLElement).getByRole("option", { name: "Lechuga" })).toBeInTheDocument();
    expect(within(groups[1] as HTMLElement).getByRole("option", { name: "Tomate" })).toBeInTheDocument();
  });

  it("editar precarga los valores actuales y guarda sobre la misma fila", async () => {
    const user = userEvent.setup();
    updatePlantBedAction.mockResolvedValue({ ok: true, rows: [] });
    renderModal({ rows: [row({ id: 4, description: "Cherry" })] });

    await user.click(screen.getByRole("button", { name: "Editar cultivo" }));

    expect(screen.getByRole("combobox", { name: /Cultivo/ })).toHaveValue("1");
    expect(screen.getByRole("textbox", { name: /Tipo/ })).toHaveValue("Cherry");

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(updatePlantBedAction).toHaveBeenCalledOnce());
    expect(updatePlantBedAction).toHaveBeenCalledWith({
      id: 4,
      plantId: 1,
      description: "Cherry",
    });
  });

  it("si el servidor rechaza el alta, el error se ve y el formulario sigue abierto", async () => {
    const user = userEvent.setup();
    addPlantBedAction.mockResolvedValue({ ok: false, error: "No cabe otro cultivo." });
    renderModal();

    await user.click(screen.getByRole("button", { name: /Añadir cultivo/ }));
    await user.selectOptions(screen.getByRole("combobox", { name: /Cultivo/ }), "1");
    await user.click(screen.getByRole("button", { name: "Añadir" }));

    expect(await screen.findByText("No cabe otro cultivo.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Añadir" })).toBeInTheDocument();
  });
});

describe("BedModal — borrado", () => {
  it("pide doble confirmación antes de borrar", async () => {
    const user = userEvent.setup();
    deletePlantBedAction.mockResolvedValue({ ok: true, rows: [] });
    const { onRowDeleted } = renderModal({ rows: [row({ id: 3 })] });

    await user.click(screen.getByRole("button", { name: "Eliminar cultivo" }));
    expect(deletePlantBedAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Sí, estoy seguro" }));
    expect(deletePlantBedAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(deletePlantBedAction).toHaveBeenCalledWith(3));
    expect(onRowDeleted).toHaveBeenCalledWith(3);
  });

  it("confirmar el borrado no cierra el modal del bancal", async () => {
    const user = userEvent.setup();
    deletePlantBedAction.mockResolvedValue({ ok: true, rows: [] });
    const { onClose } = renderModal({ rows: [row({ id: 3 })] });

    await user.click(screen.getByRole("button", { name: "Eliminar cultivo" }));
    await user.click(screen.getByRole("button", { name: "Sí, estoy seguro" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(deletePlantBedAction).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });
});

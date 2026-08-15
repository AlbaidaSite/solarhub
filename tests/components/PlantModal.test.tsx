// @vitest-environment jsdom
// SUT: src/app/(app)/huerto/components/PlantModal.tsx

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />;
  },
}));

const getCropDiaryAction = vi.fn();
const addCropDiaryEntryAction = vi.fn();
const updateCropDiaryEntryAction = vi.fn();
const deleteCropDiaryEntryAction = vi.fn();
const updatePlantSectionAction = vi.fn();

vi.mock("@/app/(app)/huerto/actions", () => ({
  getCropDiaryAction: (plantId: number) => getCropDiaryAction(plantId),
  addCropDiaryEntryAction: (input: unknown) => addCropDiaryEntryAction(input),
  updateCropDiaryEntryAction: (input: unknown) => updateCropDiaryEntryAction(input),
  deleteCropDiaryEntryAction: (id: number) => deleteCropDiaryEntryAction(id),
  updatePlantSectionAction: (input: unknown) => updatePlantSectionAction(input),
}));

import PlantModal from "@/app/(app)/huerto/components/PlantModal";
import type { CropDiaryEntry, Plant } from "@/types/garden";

const tomate: Plant = {
  id: 4,
  name: "Tomate",
  icon_path: "tomate.webp",
  seed_info: "Entutorar en cuanto arraigue.",
  harvest_info: "Recolectar según maduran.",
  months_of_growth: [4, 3],
  months_of_harvest: [7, 8],
  color: "red-700",
};

function diaryEntry(overrides: Partial<CropDiaryEntry> & { id: number }): CropDiaryEntry {
  return {
    plant_id: tomate.id,
    sow_year: 2026,
    notes: `Notas ${overrides.id}`,
    updated_at: "2026-05-04T10:00:00Z",
    ...overrides,
  };
}

function renderModal(props: Partial<React.ComponentProps<typeof PlantModal>> = {}) {
  const onClose = vi.fn();
  const onPlantChange = vi.fn();

  const { container } = render(
    <PlantModal
      plant={tomate}
      canManage={false}
      onClose={onClose}
      onPlantChange={onPlantChange}
      {...props}
    />,
  );

  return { container, onClose, onPlantChange };
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  getCropDiaryAction.mockResolvedValue([]);
});

describe("PlantModal — ficha", () => {
  it("muestra icono, nombre, siembra y recolecta con sus meses en texto", async () => {
    const { container } = renderModal();

    expect(screen.getByRole("heading", { name: "Tomate", level: 1 })).toBeInTheDocument();
    // alt vacío a propósito (el nombre está justo al lado), así que el
    // icono no es consultable por rol.
    expect(container.querySelector("img")).toHaveAttribute("src", "tomate.webp");

    expect(screen.getByRole("heading", { name: "Siembra" })).toBeInTheDocument();
    expect(screen.getByText("Entutorar en cuanto arraigue.")).toBeInTheDocument();
    // Los meses llegan desordenados desde la base de datos y se pintan en
    // orden natural, con el nombre completo y separados por comas.
    expect(screen.getByText("Meses de siembra: Marzo, Abril")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Recolecta" })).toBeInTheDocument();
    expect(screen.getByText("Recolectar según maduran.")).toBeInTheDocument();
    expect(screen.getByText("Meses de recolecta: Julio, Agosto")).toBeInTheDocument();

    await waitFor(() => expect(getCropDiaryAction).toHaveBeenCalledWith(tomate.id));
  });

  it("una planta sin información lo dice en vez de dejar el hueco en blanco", () => {
    renderModal({
      plant: { ...tomate, seed_info: null, months_of_growth: null },
    });

    expect(screen.getByText("Sin información de siembra.")).toBeInTheDocument();
    expect(screen.getByText("Meses de siembra: sin definir")).toBeInTheDocument();
  });

  // El requisito es explícito: el diario va separado del resto de campos.
  it("el diario queda separado del resto de la ficha por una línea", () => {
    const { container } = renderModal();
    expect(container.querySelector("hr")).toBeInTheDocument();
  });

  it("sin permiso no hay nada que editar", async () => {
    getCropDiaryAction.mockResolvedValue([diaryEntry({ id: 1 })]);
    renderModal({ canManage: false });

    expect(await screen.findByText("Notas 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Añadir entrada/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Eliminar/ })).not.toBeInTheDocument();
  });
});

describe("PlantModal — edición de siembra y recolecta", () => {
  it("un garden manager edita el texto y los meses de una sección", async () => {
    const user = userEvent.setup();
    const updated = { ...tomate, seed_info: "Sembrar en semillero." };
    updatePlantSectionAction.mockResolvedValue({ ok: true, plant: updated });
    const { onPlantChange } = renderModal({ canManage: true });

    await user.click(screen.getByRole("button", { name: "Editar siembra" }));

    const info = screen.getByRole("textbox", { name: "Información de siembra" });
    expect(info).toHaveValue("Entutorar en cuanto arraigue.");
    await user.clear(info);
    await user.type(info, "Sembrar en semillero.");

    // Marzo estaba marcado (months_of_growth = [3, 4]); se quita y se
    // añade mayo.
    expect(screen.getByRole("checkbox", { name: "Marzo" })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Marzo" }));
    await user.click(screen.getByRole("checkbox", { name: "Mayo" }));

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(updatePlantSectionAction).toHaveBeenCalledOnce());
    expect(updatePlantSectionAction).toHaveBeenCalledWith({
      plantId: tomate.id,
      section: "siembra",
      info: "Sembrar en semillero.",
      months: [4, 5],
    });
    expect(onPlantChange).toHaveBeenCalledWith(updated);
  });

  it("editar la recolecta manda la otra sección, no la de siembra", async () => {
    const user = userEvent.setup();
    updatePlantSectionAction.mockResolvedValue({ ok: true, plant: tomate });
    renderModal({ canManage: true });

    await user.click(screen.getByRole("button", { name: "Editar recolecta" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(updatePlantSectionAction).toHaveBeenCalledOnce());
    expect(updatePlantSectionAction).toHaveBeenCalledWith(
      expect.objectContaining({ section: "recolecta", months: [7, 8] }),
    );
  });

  it("si el servidor rechaza el guardado, el error se ve y el formulario sigue abierto", async () => {
    const user = userEvent.setup();
    updatePlantSectionAction.mockResolvedValue({ ok: false, error: "No tienes permiso." });
    renderModal({ canManage: true });

    await user.click(screen.getByRole("button", { name: "Editar siembra" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("No tienes permiso.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
  });
});

describe("PlantModal — diario", () => {
  it("sin entradas lo dice, y con permiso se puede crear la primera", async () => {
    const user = userEvent.setup();
    addCropDiaryEntryAction.mockResolvedValue({
      ok: true,
      entries: [diaryEntry({ id: 9, sow_year: 2025, notes: "Buena cosecha." })],
    });
    renderModal({ canManage: true });

    expect(
      await screen.findByText("Este cultivo todavía no tiene entradas de diario."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Añadir entrada/ }));
    await user.clear(screen.getByRole("spinbutton", { name: /Año de siembra/ }));
    await user.type(screen.getByRole("spinbutton", { name: /Año de siembra/ }), "2025");
    await user.type(screen.getByRole("textbox", { name: "Notas" }), "Buena cosecha.");
    await user.click(screen.getByRole("button", { name: "Añadir" }));

    await waitFor(() => expect(addCropDiaryEntryAction).toHaveBeenCalledOnce());
    expect(addCropDiaryEntryAction).toHaveBeenCalledWith({
      plantId: tomate.id,
      sowYear: 2025,
      notes: "Buena cosecha.",
    });
    // Se salta al año de lo que se acaba de escribir, aunque no fuera el
    // que se estaba mirando.
    expect(await screen.findByText("Buena cosecha.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Año" })).toHaveValue("2025");
  });

  it("solo se puede ir a los años que tienen entradas, y el desplegable salta a uno", async () => {
    const user = userEvent.setup();
    getCropDiaryAction.mockResolvedValue([
      diaryEntry({ id: 1, sow_year: 2026, notes: "Año en curso." }),
      diaryEntry({ id: 2, sow_year: 2021, notes: "Hace tiempo." }),
    ]);
    renderModal();

    const yearSelect = await screen.findByRole("combobox", { name: "Año" });
    // 2022..2025 no tienen diario: no aparecen por ningún lado.
    expect(within(yearSelect).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "2026",
      "2021",
    ]);
    expect(screen.getByText("Año en curso.")).toBeInTheDocument();

    await user.selectOptions(yearSelect, "2021");
    expect(screen.getByText("Hace tiempo.")).toBeInTheDocument();
    expect(screen.queryByText("Año en curso.")).not.toBeInTheDocument();
  });

  it("las flechas dan la vuelta por los extremos, como los meses", async () => {
    const user = userEvent.setup();
    getCropDiaryAction.mockResolvedValue([
      diaryEntry({ id: 1, sow_year: 2026, notes: "Año en curso." }),
      diaryEntry({ id: 2, sow_year: 2021, notes: "Hace tiempo." }),
    ]);
    renderModal();

    expect(await screen.findByText("Año en curso.")).toBeInTheDocument();

    // Hacia atrás desde el más reciente: 2021.
    await user.click(screen.getByRole("button", { name: "Año anterior" }));
    expect(screen.getByText("Hace tiempo.")).toBeInTheDocument();

    // Y una más hacia atrás vuelve al principio en vez de quedarse ahí.
    await user.click(screen.getByRole("button", { name: "Año anterior" }));
    expect(screen.getByText("Año en curso.")).toBeInTheDocument();

    // También en el otro sentido.
    await user.click(screen.getByRole("button", { name: "Año siguiente" }));
    expect(screen.getByText("Hace tiempo.")).toBeInTheDocument();
  });

  it("con un único año las flechas no llevan a ninguna parte", async () => {
    getCropDiaryAction.mockResolvedValue([diaryEntry({ id: 1 })]);
    renderModal();

    expect(await screen.findByRole("button", { name: "Año anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Año siguiente" })).toBeDisabled();
  });

  it("un mismo año puede tener varias entradas y se ven todas", async () => {
    getCropDiaryAction.mockResolvedValue([
      diaryEntry({ id: 1, notes: "En marzo se sembró." }),
      diaryEntry({ id: 2, notes: "En julio se recogió." }),
    ]);
    renderModal();

    expect(await screen.findByText("En marzo se sembró.")).toBeInTheDocument();
    expect(screen.getByText("En julio se recogió.")).toBeInTheDocument();
  });

  it("editar una entrada precarga sus valores y guarda sobre la misma fila", async () => {
    const user = userEvent.setup();
    getCropDiaryAction.mockResolvedValue([diaryEntry({ id: 7, sow_year: 2024, notes: "Regular." })]);
    updateCropDiaryEntryAction.mockResolvedValue({
      ok: true,
      entries: [diaryEntry({ id: 7, sow_year: 2024, notes: "Regular. Mucho pulgón." })],
    });
    renderModal({ canManage: true });

    await user.click(await screen.findByRole("button", { name: "Editar entrada del diario" }));

    expect(screen.getByRole("spinbutton", { name: /Año de siembra/ })).toHaveValue(2024);
    const notes = screen.getByRole("textbox", { name: "Notas" });
    expect(notes).toHaveValue("Regular.");
    await user.type(notes, " Mucho pulgón.");

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(updateCropDiaryEntryAction).toHaveBeenCalledOnce());
    expect(updateCropDiaryEntryAction).toHaveBeenCalledWith({
      id: 7,
      sowYear: 2024,
      notes: "Regular. Mucho pulgón.",
    });
    expect(await screen.findByText("Regular. Mucho pulgón.")).toBeInTheDocument();
  });

  it("borrar una entrada pide doble confirmación y la quita del diario", async () => {
    const user = userEvent.setup();
    getCropDiaryAction.mockResolvedValue([diaryEntry({ id: 3, notes: "Se perdió la cosecha." })]);
    deleteCropDiaryEntryAction.mockResolvedValue({ ok: true });
    renderModal({ canManage: true });

    await user.click(await screen.findByRole("button", { name: "Eliminar entrada del diario" }));
    expect(deleteCropDiaryEntryAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Sí, estoy seguro" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(deleteCropDiaryEntryAction).toHaveBeenCalledWith(3));
    expect(await screen.findByText("Este cultivo todavía no tiene entradas de diario.")).toBeInTheDocument();
  });
});

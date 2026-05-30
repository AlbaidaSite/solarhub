// @vitest-environment jsdom
// SUT: src/app/staff/components/ConfirmDialog.tsx
//
// Diálogo en 2 pasos para borrados. El layout invierte la posición del
// botón principal entre paso 1 y paso 2 para evitar que un doble-click
// rápido sobre el mismo punto confirme accidentalmente.

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmDialog from "@/app/staff/components/ConfirmDialog";

beforeEach(() => cleanup());

const baseProps = {
  step1Message: "¿Borrar el cromo?",
  step2Message: "¿Confirmar eliminación?",
  confirmLabel: "Sí, borrar",
  pendingLabel: "Borrando…",
  isPending: false,
  error: null,
  onAdvance: vi.fn(),
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe("ConfirmDialog · paso 1 (entrar)", () => {
  it("muestra el mensaje de paso 1 y los dos botones", () => {
    render(<ConfirmDialog {...baseProps} step="confirm1" />);
    expect(screen.getByText("¿Borrar el cromo?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sí, borrar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
  });

  it("click en el botón principal llama a onAdvance, no a onConfirm", async () => {
    const onAdvance = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        {...baseProps}
        step="confirm1"
        onAdvance={onAdvance}
        onConfirm={onConfirm}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));
    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("click en No llama a onCancel", async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} step="confirm1" onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: "No" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("ConfirmDialog · paso 2 (confirmar)", () => {
  it("muestra el mensaje de paso 2 y los botones Cancelar / Confirmar", () => {
    render(<ConfirmDialog {...baseProps} step="confirm2" />);
    expect(screen.getByText("¿Confirmar eliminación?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
  });

  it("posición de los botones invertida entre paso 1 y paso 2 (anti doble-click)", () => {
    // En paso 1, el botón rojo (principal) está a la IZQUIERDA.
    const { container: c1 } = render(
      <ConfirmDialog {...baseProps} step="confirm1" />,
    );
    const buttonsRow1 = within(c1).getAllByRole("button");
    expect(buttonsRow1[0]).toHaveTextContent("Sí, borrar");
    cleanup();

    // En paso 2, el botón rojo (Confirmar) está a la DERECHA.
    const { container: c2 } = render(
      <ConfirmDialog {...baseProps} step="confirm2" />,
    );
    const buttonsRow2 = within(c2).getAllByRole("button");
    expect(buttonsRow2[buttonsRow2.length - 1]).toHaveTextContent("Confirmar");
  });

  it("click en Confirmar llama a onConfirm", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog {...baseProps} step="confirm2" onConfirm={onConfirm} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("ConfirmDialog · estado pending y error", () => {
  it("isPending=true desactiva ambos botones y muestra el label pending", () => {
    render(<ConfirmDialog {...baseProps} step="confirm2" isPending={true} />);
    expect(screen.getByText("Borrando…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    // El botón principal lleva el pendingLabel en lugar de "Confirmar".
    expect(
      screen.getByRole("button", { name: "Borrando…" }),
    ).toBeDisabled();
  });

  it("error se muestra debajo solo en paso 2", () => {
    render(
      <ConfirmDialog {...baseProps} step="confirm2" error="RLS denied" />,
    );
    expect(screen.getByText("RLS denied")).toBeInTheDocument();
  });
});

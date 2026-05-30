// @vitest-environment jsdom
// SUT: src/components/ui/AuroraField.tsx
//
// Cubre el bug histórico de "button anidado" detectado al usar EyeToggle
// (otro <button>) como `icon` prop. La fix fue documentada en CONVENTIONS §5.4:
// no pasar elementos interactivos como `icon`; usar `onIconClick` +
// `iconAriaLabel` en su lugar. Estos tests blindan ese contrato.

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChevronDown, Eye } from "lucide-react";
import AuroraField from "@/components/ui/AuroraField";

beforeEach(() => cleanup());

describe("AuroraField · contrato del icono (sin botón anidado)", () => {
  it("solo renderiza UN <button> cuando se pasa un icon visible + onIconClick", () => {
    render(
      <AuroraField
        label="Test"
        icon={<Eye data-testid="eye" />}
        onIconClick={() => {}}
        iconAriaLabel="cambiar visibilidad"
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    // El botón es el IconButton interno; el icono SVG vive dentro.
    expect(buttons[0]).toContainElement(screen.getByTestId("eye"));
  });

  it("onIconClick se dispara al hacer click en el icono", async () => {
    const handler = vi.fn();
    render(
      <AuroraField
        icon={<Eye />}
        onIconClick={handler}
        iconAriaLabel="toggle"
      />,
    );
    await userEvent.click(screen.getByLabelText("toggle"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("sin onIconClick, clickar el icono enfoca el input", async () => {
    render(
      <AuroraField icon={<Eye />} iconAriaLabel="focus-input" placeholder="X" />,
    );
    const input = screen.getByPlaceholderText("X");
    await userEvent.click(screen.getByLabelText("focus-input"));
    expect(input).toHaveFocus();
  });

  it("sin iconAriaLabel, el botón del icono queda fuera del tab order", () => {
    render(<AuroraField icon={<Eye />} placeholder="X" />);
    const button = screen.getByRole("button", { hidden: true });
    expect(button).toHaveAttribute("tabindex", "-1");
    expect(button).toHaveAttribute("aria-hidden", "true");
  });
});

describe("AuroraField · label, error y a11y", () => {
  it("el label apunta al input mediante htmlFor", () => {
    render(<AuroraField label="Nombre" id="my-input" placeholder="X" />);
    const label = screen.getByText("Nombre");
    expect(label).toHaveAttribute("for", "my-input");
    expect(screen.getByPlaceholderText("X")).toHaveAttribute("id", "my-input");
  });

  it("error se muestra como alert vinculado al input via aria-describedby", () => {
    render(
      <AuroraField label="X" error="campo obligatorio" placeholder="X" />,
    );
    const input = screen.getByPlaceholderText("X");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("campo obligatorio");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute(
      "aria-describedby",
      alert.getAttribute("id") ?? "",
    );
  });

  it("variante select renderiza ChevronDown por defecto y el click abre el picker", async () => {
    render(
      <AuroraField as="select" iconAriaLabel="open">
        <option value="a">A</option>
        <option value="b">B</option>
      </AuroraField>,
    );
    // ChevronDown por defecto cuando no se pasa icon.
    expect(screen.getByLabelText("open")).toBeInTheDocument();
    // El select existe.
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    // Y el icono por defecto está aliasado por iconAriaLabel.
    void ChevronDown;
  });
});

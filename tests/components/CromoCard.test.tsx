// @vitest-environment jsdom
// SUT: src/app/(app)/cromos/components/CromoCard.tsx
//
// Un cromo que no se tiene se pinta con la imagen DE VERDAD y un filtro
// CSS en gris. Arrastrarla fuera de la página o abrirla con el botón
// derecho devolvía el original a todo color, así que la rejilla del álbum
// filtraba esos dos gestos. Es un cierre de atajos, no una protección:
// la URL sigue estando en la red.

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, createEvent, fireEvent } from "@testing-library/react";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, className, draggable, onContextMenu } = props as {
      src: string;
      alt: string;
      className?: string;
      draggable?: boolean;
      onContextMenu?: (e: React.MouseEvent) => void;
    };
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        draggable={draggable}
        onContextMenu={onContextMenu}
      />
    );
  },
}));

// vanilla-tilt se carga con import() dinámico y toca el DOM real; el
// componente ya ignora el fallo, así que se le da uno silencioso.
vi.mock("vanilla-tilt", () => ({ default: { init: vi.fn() } }));

import CromoCard from "@/app/(app)/cromos/components/CromoCard";

const baseCromo = {
  id: 1,
  name: "Test Cromo",
  front_thumb: "front-thumb.webp",
  ownershipState: "owned" as const,
  isImageLocked: false,
  how_to: null,
};

beforeEach(cleanup);

describe("CromoCard · imagen de un cromo que no se tiene", () => {
  it("no se puede arrastrar ni abrir con el botón derecho", () => {
    render(<CromoCard cromo={{ ...baseCromo, ownershipState: "never_owned" }} />);

    const img = screen.getByAltText("Test Cromo");
    expect(img).toHaveAttribute("draggable", "false");

    const menu = createEvent.contextMenu(img);
    fireEvent(img, menu);
    expect(menu.defaultPrevented).toBe(true);
  });

  it("un cromo ya devuelto (formerly_owned) sigue protegido", () => {
    render(<CromoCard cromo={{ ...baseCromo, ownershipState: "formerly_owned" }} />);
    expect(screen.getByAltText("Test Cromo")).toHaveAttribute("draggable", "false");
  });

  it("el cromo propio se puede arrastrar y abrir con el botón derecho", () => {
    render(<CromoCard cromo={baseCromo} />);

    const img = screen.getByAltText("Test Cromo");
    expect(img).toHaveAttribute("draggable", "true");

    const menu = createEvent.contextMenu(img);
    fireEvent(img, menu);
    expect(menu.defaultPrevented).toBe(false);
  });
});

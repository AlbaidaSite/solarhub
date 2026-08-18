// @vitest-environment jsdom
// SUT: src/app/(app)/cromos/components/CromoModal.tsx
//
// Cubre los bugs históricos del modal (sección §5 de CONVENTIONS):
//   · El scroll del <main> debe bloquearse mientras el modal está abierto.
//   · La tecla Escape cierra el modal.
//   · El TradeCromoPanel se monta vía portal a document.body — porque el
//     modal tiene `backdrop-blur-md` que crea un containing block para
//     `position: fixed` y rompía el viewport en móvil.
//
// jsdom no calcula CSS layout real, así que verificamos la SEMÁNTICA
// (style.overflow, ubicación del nodo en el árbol, llamadas) que es lo
// que blinda el contrato.

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, createEvent, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Se dejan pasar las props que sí son de <img> —incluidas draggable y
// onContextMenu, que son las que protegen la imagen a color— y se filtran
// las propias de next/image, que en un <img> suelto solo darían warnings.
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
// CornerButton no tiene dependencias problemáticas, lo dejamos real.
// TradeCromoPanel sí: importa server actions con server-only. Lo mockeamos
// con un sustituto reconocible para verificar la posición DOM (portal).
vi.mock("@/app/(app)/cromos/components/TradeCromoPanel", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="trade-panel">
      panel mocked
      <button onClick={onClose}>cerrar panel</button>
    </div>
  ),
}));

import CromoModal from "@/app/(app)/cromos/components/CromoModal";
import type { CromoDetail } from "@/types/cromo";

const baseCromo: CromoDetail = {
  id: 1,
  name: "Test Cromo",
  number: 1,
  variant: 0,
  description: null,
  copies: 1,
  how_to: null,
  how_to_extended: null,
  ownershipState: "owned",
  isImageLocked: false,
  firstAcquiredAt: null,
  userOwnedUniques: [{ uniqueId: 1, copyNumber: 1, inTrade: false }],
  front_img: "front.webp",
  front_thumb: "front-thumb.webp",
  back_img: "back.webp",
  rarity: null,
  category: null,
  artists: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  // CromoModal busca un <main> en el DOM y guarda/restaura su overflow.
  document.body.innerHTML = "";
  const main = document.createElement("main");
  main.style.overflow = "auto"; // estado previo
  document.body.appendChild(main);
});

describe("CromoModal · scroll lock del fondo", () => {
  it("al montar, pone main.style.overflow='hidden'", () => {
    const main = document.querySelector("main")!;
    expect(main.style.overflow).toBe("auto");
    render(<CromoModal cromo={baseCromo} onClose={vi.fn()} />);
    expect(main.style.overflow).toBe("hidden");
  });

  it("al desmontar, restaura el overflow previo", () => {
    const main = document.querySelector("main")!;
    const { unmount } = render(
      <CromoModal cromo={baseCromo} onClose={vi.fn()} />,
    );
    expect(main.style.overflow).toBe("hidden");
    unmount();
    expect(main.style.overflow).toBe("auto");
  });
});

describe("CromoModal · keyboard shortcuts", () => {
  it("Escape llama a onClose", async () => {
    const onClose = vi.fn();
    render(<CromoModal cromo={baseCromo} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ArrowLeft / ArrowRight llaman a onPrev / onNext", async () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(
      <CromoModal
        cromo={baseCromo}
        onClose={vi.fn()}
        onPrev={onPrev}
        onNext={onNext}
      />,
    );
    await userEvent.keyboard("{ArrowLeft}");
    expect(onPrev).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{ArrowRight}");
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

describe("CromoModal · trade panel via portal (fix del backdrop-filter)", () => {
  it("inicialmente NO renderiza el trade panel", () => {
    render(<CromoModal cromo={baseCromo} onClose={vi.fn()} />);
    expect(screen.queryByTestId("trade-panel")).not.toBeInTheDocument();
  });

  it("seleccionar copia + click en 'Intercambiar' monta el panel via portal a document.body", async () => {
    const { container } = render(
      <CromoModal cromo={baseCromo} onClose={vi.fn()} />,
    );

    // Seleccionamos la copia #1.
    await userEvent.click(screen.getByRole("button", { name: "#1" }));
    await userEvent.click(
      screen.getByRole("button", { name: /intercambiar/i }),
    );

    const panel = screen.getByTestId("trade-panel");
    expect(panel).toBeInTheDocument();

    // Verificación clave: el panel NO es descendiente del contenedor del
    // modal renderizado por React (createPortal lo saca del árbol). Por
    // tanto la propiedad CSS `backdrop-filter` del modal de cromo no le
    // afecta como containing block para `position: fixed`.
    expect(container.contains(panel)).toBe(false);
    expect(document.body.contains(panel)).toBe(true);
  });

  it("sin copias seleccionadas, click en 'Intercambiar' muestra error y NO abre panel", async () => {
    render(<CromoModal cromo={baseCromo} onClose={vi.fn()} />);
    await userEvent.click(
      screen.getByRole("button", { name: /intercambiar/i }),
    );
    expect(
      screen.getByText(/Es necesario escoger la copia a intercambiar/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("trade-panel")).not.toBeInTheDocument();
  });
});

describe("CromoModal · ownership state controla qué se muestra", () => {
  it("never_owned: NO renderiza el bloque de copias ni el botón Intercambiar", () => {
    const neverOwned: CromoDetail = {
      ...baseCromo,
      ownershipState: "never_owned",
      userOwnedUniques: [],
      isImageLocked: false,
    };
    render(<CromoModal cromo={neverOwned} onClose={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: /intercambiar/i }),
    ).not.toBeInTheDocument();
  });

  it("isImageLocked muestra 'Bloqueado' en lugar del nombre del cromo", () => {
    const locked: CromoDetail = {
      ...baseCromo,
      isImageLocked: true,
      ownershipState: "never_owned",
      userOwnedUniques: [],
    };
    render(<CromoModal cromo={locked} onClose={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Bloqueado" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Test Cromo" })).not.toBeInTheDocument();
  });
});


describe("CromoModal · imagen de un cromo que no se tiene", () => {
  // El gris es un filtro CSS sobre la imagen buena: arrastrarla fuera o
  // abrirla con el botón derecho la devolvía a todo color.
  it("no se puede arrastrar ni abrir con el botón derecho", () => {
    render(
      <CromoModal
        cromo={{ ...baseCromo, ownershipState: "never_owned", userOwnedUniques: [] }}
        onClose={vi.fn()}
      />,
    );

    const img = screen.getByAltText("Test Cromo");
    expect(img).toHaveAttribute("draggable", "false");

    const menu = createEvent.contextMenu(img);
    fireEvent(img, menu);
    expect(menu.defaultPrevented).toBe(true);
  });

  it("el cromo propio se puede arrastrar y abrir con el botón derecho", () => {
    render(<CromoModal cromo={baseCromo} onClose={vi.fn()} />);

    const img = screen.getByAltText("Test Cromo");
    expect(img).toHaveAttribute("draggable", "true");

    const menu = createEvent.contextMenu(img);
    fireEvent(img, menu);
    expect(menu.defaultPrevented).toBe(false);
  });
});

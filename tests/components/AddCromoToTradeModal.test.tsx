// @vitest-environment jsdom
// SUT: src/app/(app)/intercambios/[id]/components/AddCromoToTradeModal.tsx
//
// El modal listaba TODAS las copias del usuario, incluidas las ya
// comprometidas en otro intercambio abierto: al pulsarlas, el trigger
// trg_unique_not_in_active_trade rechazaba el insert. Ahora se listan
// tachadas y deshabilitadas —mismo criterio que la sección "Copias" del
// CromoModal— y los cromos sin ninguna copia libre bajan al fondo.

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

// Las server actions arrastran `server-only` y el cliente de Supabase.
const getUserOwnedCromosForTradeAction = vi.fn();
const addUniqueToOfferAction = vi.fn();
vi.mock("@/app/(app)/intercambios/[id]/actions", () => ({
  getUserOwnedCromosForTradeAction: (...args: unknown[]) =>
    getUserOwnedCromosForTradeAction(...args),
  addUniqueToOfferAction: (...args: unknown[]) => addUniqueToOfferAction(...args),
}));

import AddCromoToTradeModal from "@/app/(app)/intercambios/[id]/components/AddCromoToTradeModal";

// Alfa conserva la copia #1 libre; Bravo tiene su única copia comprometida.
const cromos = [
  {
    cromoId: 1,
    cromoName: "Alfa",
    thumbPath: "cromos/alfa.webp",
    uniques: [
      { uniqueId: 10, copyNumber: 1, inTrade: false },
      { uniqueId: 11, copyNumber: 2, inTrade: true },
    ],
  },
  {
    cromoId: 2,
    cromoName: "Bravo",
    thumbPath: "cromos/bravo.webp",
    uniques: [{ uniqueId: 20, copyNumber: 1, inTrade: true }],
  },
];

function renderModal() {
  return render(
    <AddCromoToTradeModal tradeOfferId={9} onClose={vi.fn()} onAdded={vi.fn()} />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  getUserOwnedCromosForTradeAction.mockResolvedValue(cromos);
  addUniqueToOfferAction.mockResolvedValue({ ok: true });
});

describe("AddCromoToTradeModal · etiquetas de copia", () => {
  it("muestra solo #N, sin la palabra «Copia»", async () => {
    renderModal();
    await screen.findAllByRole("button", { name: "#1" });

    expect(screen.queryByText(/copia #/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "#1" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "#2" })).toBeInTheDocument();
  });
});

describe("AddCromoToTradeModal · copias comprometidas en otro intercambio", () => {
  it("las tacha y las deja sin clic", async () => {
    renderModal();
    const comprometida = await screen.findByRole("button", { name: "#2" });

    expect(comprometida).toBeDisabled();
    expect(comprometida.className).toContain("line-through");

    await userEvent.click(comprometida);
    // Sin selección, el botón de añadir sigue deshabilitado.
    expect(screen.getByRole("button", { name: /añadir a mi oferta/i })).toBeDisabled();
  });

  it("una copia libre se sigue pudiendo seleccionar y añadir", async () => {
    renderModal();
    const libre = (await screen.findAllByRole("button", { name: "#1" }))[0];

    expect(libre).toBeEnabled();
    await userEvent.click(libre);

    const añadir = screen.getByRole("button", { name: /añadir a mi oferta/i });
    expect(añadir).toBeEnabled();
    await userEvent.click(añadir);

    await waitFor(() => expect(addUniqueToOfferAction).toHaveBeenCalledWith(9, 10));
  });

  it("respeta el orden que llega del servidor (cromos bloqueados al fondo)", async () => {
    renderModal();
    await screen.findByText("Alfa");

    const nombres = screen.getAllByText(/^(Alfa|Bravo)$/).map((n) => n.textContent);
    expect(nombres).toEqual(["Alfa", "Bravo"]);
  });
});

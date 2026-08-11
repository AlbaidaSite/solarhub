// @vitest-environment jsdom
// SUT: src/app/(app)/eventos/components/BirthdayPills.tsx
//
// Cada pastilla es ahora el propio botón de "mostrar interés": clic
// alterna el estado (optimista, vía onInterestToggled) y llama a
// toggleEventInterestAction. El crecimiento de la pastilla apuntada
// sigue siendo 100% CSS (`:has()` sobre flex-grow, ver
// src/styles/globals.css) — jsdom no calcula layout real, así que lo
// verificable aquí es que el hover no dispara nada por JS.

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { EventOccurrence } from "@/types/events";

vi.mock("@/app/(app)/eventos/actions", () => ({
  toggleEventInterestAction: vi.fn(),
}));

import { toggleEventInterestAction } from "@/app/(app)/eventos/actions";
import BirthdayPills from "@/app/(app)/eventos/components/BirthdayPills";

function makeBirthday(
  id: number,
  title: string,
  overrides: Partial<EventOccurrence> = {},
): EventOccurrence {
  return {
    id,
    occurrenceDate: "2026-06-15",
    title,
    description: null,
    place: null,
    imageUrl: null,
    url: null,
    includesCromo: false,
    eventDate: "2026-06-15T00:00:00Z",
    endDate: null,
    startTimeIncluded: false,
    endTimeIncluded: true,
    liked: false,
    eventType: {
      id: 2,
      code: "BIRTHDAY",
      name: "Cumpleaños",
      icon_path: "icons/birthday.svg",
      color: "rose-400",
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  vi.mocked(toggleEventInterestAction).mockResolvedValue({ ok: true, liked: true });
});

describe("BirthdayPills", () => {
  it("no renderiza nada sin cumpleaños", () => {
    const { container } = render(<BirthdayPills birthdays={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("una sola pastilla: el hover no dispara ningún handler ni cambia el DOM", () => {
    const birthday = makeBirthday(1, "Cumple de Ana");
    render(<BirthdayPills birthdays={[birthday]} />);

    const pill = screen.getByTitle("Cumple de Ana");
    const classNameBefore = pill.className;
    fireEvent.mouseOver(pill);
    fireEvent.mouseEnter(pill);

    expect(pill.className).toBe(classNameBefore);
  });

  it("con dos pastillas, ambas se renderizan dentro del contenedor .ev-pills", () => {
    const a = makeBirthday(1, "Cumple de Ana");
    const b = makeBirthday(2, "Cumple de Bea");
    const { container } = render(<BirthdayPills birthdays={[a, b]} />);

    const wrapper = container.querySelector(".ev-pills");
    expect(wrapper?.querySelectorAll(".ev-pill")).toHaveLength(2);
  });

  it("la pastilla entera es el botón de interés: clic optimista y llamada al servidor", () => {
    const birthday = makeBirthday(1, "Cumple de Ana", { liked: false });
    const onInterestToggled = vi.fn();
    render(<BirthdayPills birthdays={[birthday]} onInterestToggled={onInterestToggled} />);

    const pill = screen.getByTitle("Cumple de Ana");
    expect(pill.tagName).toBe("BUTTON");

    fireEvent.click(pill);

    // Optimista: se notifica el nuevo estado antes de que resuelva la promesa.
    expect(onInterestToggled).toHaveBeenCalledWith(1, true);
    expect(toggleEventInterestAction).toHaveBeenCalledWith(1);
  });

  it("deshace el cambio optimista si el servidor responde con error", async () => {
    vi.mocked(toggleEventInterestAction).mockResolvedValue({ ok: false, error: "fallo" });
    const birthday = makeBirthday(1, "Cumple de Ana", { liked: false });
    const onInterestToggled = vi.fn();
    render(<BirthdayPills birthdays={[birthday]} onInterestToggled={onInterestToggled} />);

    fireEvent.click(screen.getByTitle("Cumple de Ana"));

    await waitFor(() => {
      expect(onInterestToggled).toHaveBeenLastCalledWith(1, false);
    });
  });
});

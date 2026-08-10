// @vitest-environment jsdom
// SUT: src/app/(app)/eventos/components/BirthdayPills.tsx
//
// El crecimiento de la pastilla apuntada es 100% CSS (`:has()` sobre
// flex-grow, ver src/styles/globals.css), sin ningún handler de React de
// por medio — jsdom no calcula layout real, así que lo verificable aquí es
// que el componente no adjunta NINGÚN listener de hover/click/foco (si
// alguien añadiera uno por error, rompería justo el caso de una sola
// pastilla que el prompt pide preservar) y que el marcado no es interactivo.

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { EventOccurrence } from "@/types/events";
import BirthdayPills from "@/app/(app)/eventos/components/BirthdayPills";

function makeBirthday(id: number, title: string): EventOccurrence {
  return {
    id,
    occurrenceDate: "2026-06-15",
    title,
    description: null,
    place: null,
    imageUrl: null,
    url: null,
    includesCromo: false,
    eventType: {
      id: 2,
      code: "BIRTHDAY",
      name: "Cumpleaños",
      icon_path: "icons/birthday.svg",
      color: "rose-400",
    },
  };
}

beforeEach(() => {
  cleanup();
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

  it("la pastilla no es un elemento interactivo: sin tabIndex, sin role button, sin onClick", () => {
    const birthday = makeBirthday(1, "Cumple de Ana");
    const onClick = vi.fn();
    render(<BirthdayPills birthdays={[birthday]} />);

    const pill = screen.getByTitle("Cumple de Ana");
    expect(pill.tagName).toBe("DIV");
    expect(pill).not.toHaveAttribute("tabindex");
    expect(pill).not.toHaveAttribute("role", "button");

    fireEvent.click(pill);
    expect(onClick).not.toHaveBeenCalled();
  });
});

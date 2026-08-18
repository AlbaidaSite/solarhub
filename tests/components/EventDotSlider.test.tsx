// @vitest-environment jsdom
// SUT: src/app/(app)/eventos/components/EventDotSlider.tsx

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { EventOccurrence } from "@/types/events";
import EventDotSlider from "@/app/(app)/eventos/components/EventDotSlider";

function makeOccurrence(id: number): EventOccurrence {
  return {
    id,
    occurrenceDate: "2026-06-15",
    title: `Evento ${id}`,
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
      id: 1,
      code: "GENERIC",
      name: "Genérico",
      icon_path: "icons/generic.svg",
      color: "amber-400",
    },
  };
}

beforeEach(() => {
  cleanup();
});

describe("EventDotSlider", () => {
  it("no renderiza nada sin eventos ni desbordamiento", () => {
    const { container } = render(
      <EventDotSlider
        dotSequence={{ visible: [], overflowCount: 0 }}
        visibleEventId={null}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("cada punto es un botón con aria-label del evento", () => {
    const a = makeOccurrence(1);
    render(
      <EventDotSlider
        dotSequence={{ visible: [a], overflowCount: 0 }}
        visibleEventId={null}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: a.title })).toBeInTheDocument();
  });

  it("onMouseEnter y onFocus llaman a onSelect con el id del evento", () => {
    const a = makeOccurrence(1);
    const onSelect = vi.fn();
    render(
      <EventDotSlider
        dotSequence={{ visible: [a], overflowCount: 0 }}
        visibleEventId={null}
        onSelect={onSelect}
        onOpen={vi.fn()}
      />,
    );

    const dot = screen.getByRole("button", { name: a.title });
    fireEvent.mouseEnter(dot);
    fireEvent.focus(dot);

    expect(onSelect).toHaveBeenNthCalledWith(1, a.id);
    expect(onSelect).toHaveBeenNthCalledWith(2, a.id);
  });

  it("el clic sobre un punto abre el detalle de ESE evento", () => {
    const a = makeOccurrence(1);
    const b = makeOccurrence(2);
    const onOpen = vi.fn();
    render(
      <EventDotSlider
        dotSequence={{ visible: [a, b], overflowCount: 0 }}
        visibleEventId={a.id}
        onSelect={vi.fn()}
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: b.title }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(b.id);
  });

  // La capa de imagen de la celda es hermana del slider y abre por su
  // cuenta el detalle del evento visible: sin detener la propagación, un
  // clic en un punto abriría el modal dos veces (ver CalendarCell.tsx).
  it("el clic no se propaga más allá del punto", () => {
    const a = makeOccurrence(1);
    const onAncestorClick = vi.fn();
    render(
      <div onClick={onAncestorClick}>
        <EventDotSlider
          dotSequence={{ visible: [a], overflowCount: 0 }}
          visibleEventId={a.id}
          onSelect={vi.fn()}
          onOpen={vi.fn()}
        />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: a.title }));

    expect(onAncestorClick).not.toHaveBeenCalled();
  });

  it("todos los puntos comparten el mismo tamaño y no llevan anillo (ese lenguaje visual queda para otro uso)", () => {
    const a = makeOccurrence(1);
    const b = makeOccurrence(2);
    render(
      <EventDotSlider
        dotSequence={{ visible: [a, b], overflowCount: 0 }}
        visibleEventId={b.id}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    const dotA = screen.getByRole("button", { name: a.title });
    const dotB = screen.getByRole("button", { name: b.title });

    const sizeClassesOf = (el: HTMLElement) =>
      el.className.split(/\s+/).filter((c) => c.startsWith("h-") || c.startsWith("w-"));

    expect(dotA.className).not.toContain("ring-2");
    expect(dotB.className).not.toContain("ring-2");
    expect(sizeClassesOf(dotA)).toEqual(sizeClassesOf(dotB));

    expect(dotA).toHaveAttribute("aria-current", "false");
    expect(dotB).toHaveAttribute("aria-current", "true");
  });

  it("el punto activo se rellena de blanco; el resto lleva el color de su tipo", () => {
    const a = makeOccurrence(1);
    const b = makeOccurrence(2);
    render(
      <EventDotSlider
        dotSequence={{ visible: [a, b], overflowCount: 0 }}
        visibleEventId={b.id}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    const dotA = screen.getByRole("button", { name: a.title });
    const dotB = screen.getByRole("button", { name: b.title });

    expect(dotA.className).toContain("bg-amber-400");
    expect(dotA.className).not.toContain("bg-white");
    expect(dotB.className).toContain("bg-white");
  });

  it("con desbordamiento (7 eventos) añade un punto neutro no interactivo", () => {
    const events = Array.from({ length: 5 }, (_, i) => makeOccurrence(i + 1));
    const { container } = render(
      <EventDotSlider
        dotSequence={{ visible: events, overflowCount: 2 }}
        visibleEventId={null}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(container.querySelector("span.bg-zinc-400")).toBeInTheDocument();
  });
});

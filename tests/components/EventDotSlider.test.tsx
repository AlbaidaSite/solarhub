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
      <EventDotSlider dotSequence={{ visible: [], overflowCount: 0 }} visibleEventId={null} onSelect={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("cada punto es un botón con aria-label del evento", () => {
    const a = makeOccurrence(1);
    render(
      <EventDotSlider dotSequence={{ visible: [a], overflowCount: 0 }} visibleEventId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: a.title })).toBeInTheDocument();
  });

  it("onMouseEnter y onFocus llaman a onSelect con el id del evento", () => {
    const a = makeOccurrence(1);
    const onSelect = vi.fn();
    render(
      <EventDotSlider dotSequence={{ visible: [a], overflowCount: 0 }} visibleEventId={null} onSelect={onSelect} />,
    );

    const dot = screen.getByRole("button", { name: a.title });
    fireEvent.mouseEnter(dot);
    fireEvent.focus(dot);

    expect(onSelect).toHaveBeenNthCalledWith(1, a.id);
    expect(onSelect).toHaveBeenNthCalledWith(2, a.id);
  });

  it("el punto activo se distingue visualmente del resto", () => {
    const a = makeOccurrence(1);
    const b = makeOccurrence(2);
    render(
      <EventDotSlider
        dotSequence={{ visible: [a, b], overflowCount: 0 }}
        visibleEventId={b.id}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: a.title }).className).not.toContain("ring-2");
    expect(screen.getByRole("button", { name: b.title }).className).toContain("ring-2");
  });

  it("con desbordamiento (7 eventos) añade un punto neutro no interactivo", () => {
    const events = Array.from({ length: 5 }, (_, i) => makeOccurrence(i + 1));
    const { container } = render(
      <EventDotSlider
        dotSequence={{ visible: events, overflowCount: 2 }}
        visibleEventId={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(container.querySelector("span.bg-zinc-400")).toBeInTheDocument();
  });
});

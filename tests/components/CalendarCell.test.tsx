// @vitest-environment jsdom
// SUT: src/app/(app)/eventos/components/CalendarCell.tsx (+ EventImageLayer, EventDotSlider)
//
// Se monta a través de CalendarGrid (no CalendarCell aislado) porque
// useCalendarCell necesita el contexto que establece useCalendarGrid — de
// ahí que el harness renderice la rejilla completa y las aserciones
// localicen la única celda con eventos por su contenido (título/alt únicos
// en el test), que no colisiona con las demás celdas vacías.

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useCalendar } from "react-aria";
import { useCalendarState } from "react-stately";
import { createCalendar, today, type CalendarDate } from "@internationalized/date";
import type { EventOccurrence } from "@/types/events";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />;
  },
}));

import CalendarGrid from "@/app/(app)/eventos/components/CalendarGrid";

function makeOccurrence(overrides: Partial<EventOccurrence> & { id: number }): EventOccurrence {
  return {
    occurrenceDate: "2026-06-15",
    title: `Evento ${overrides.id}`,
    description: null,
    place: null,
    imageUrl: `https://cdn.test/event-${overrides.id}.webp`,
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
      icon_path: "https://cdn.test/icons/generic.svg",
      color: "amber-400",
    },
    ...overrides,
  };
}

function makeBirthday(overrides: Partial<EventOccurrence> & { id: number }): EventOccurrence {
  return makeOccurrence({
    imageUrl: null,
    eventType: {
      id: 2,
      code: "BIRTHDAY",
      name: "Cumpleaños",
      icon_path: "https://cdn.test/icons/birthday.svg",
      color: "rose-400",
    },
    ...overrides,
  });
}

interface HarnessProps {
  occurrences: EventOccurrence[];
  targetDate?: CalendarDate;
  stickyEventId?: number;
  isSelectedDay?: boolean;
  onSelectStickyImage?: (dateKey: string, eventId: number) => void;
  onEventSelect?: (eventId: number, occurrenceDate: string) => void;
  onDaySelect?: (dateKey: string) => void;
}

function Harness({
  occurrences,
  targetDate,
  stickyEventId,
  isSelectedDay = false,
  onSelectStickyImage = vi.fn(),
  onEventSelect,
  onDaySelect,
}: HarnessProps) {
  const state = useCalendarState({ locale: "es-ES", createCalendar });
  // useCalendarGrid/useCalendarCell leen contexto que solo useCalendar
  // establece — igual que en EventsCalendar.tsx, aunque aquí no usemos su
  // valor de retorno directamente.
  useCalendar({ "aria-label": "Calendario de prueba" }, state);
  const dateKey = (targetDate ?? state.visibleRange.start).toString();
  const occurrencesByDate = new Map([[dateKey, occurrences]]);
  const stickyImageByDate = new Map<string, number>(
    stickyEventId !== undefined ? [[dateKey, stickyEventId]] : [],
  );

  return (
    <CalendarGrid
      state={state}
      occurrencesByDate={occurrencesByDate}
      stickyImageByDate={stickyImageByDate}
      selectedDateKey={isSelectedDay ? dateKey : null}
      onSelectStickyImage={onSelectStickyImage}
      onEventSelect={onEventSelect}
      onDaySelect={onDaySelect}
    />
  );
}

function opacityOf(alt: string): string {
  const img = screen.getByAltText(alt);
  const layer = img.closest("div[style]");
  return layer ? getComputedStyle(layer).opacity : "";
}

beforeEach(() => {
  cleanup();
});

describe("CalendarCell — imagen por defecto y selección pegajosa", () => {
  it("muestra la imagen del primer evento al montar", () => {
    const a = makeOccurrence({ id: 1 });
    const b = makeOccurrence({ id: 2 });
    render(<Harness occurrences={[a, b]} />);

    expect(opacityOf(a.title)).toBe("1");
    expect(opacityOf(b.title)).toBe("0");
  });

  it("al hacer focus sobre el segundo punto cambia la imagen visible", () => {
    const a = makeOccurrence({ id: 1 });
    const b = makeOccurrence({ id: 2 });
    const onSelectStickyImage = vi.fn();
    render(<Harness occurrences={[a, b]} onSelectStickyImage={onSelectStickyImage} />);

    fireEvent.focus(screen.getByRole("button", { name: b.title }));
    expect(onSelectStickyImage).toHaveBeenCalledWith(expect.any(String), b.id);
  });

  it("con el evento fijado por selección pegajosa, la imagen visible es la fijada, no la primera", () => {
    const a = makeOccurrence({ id: 1 });
    const b = makeOccurrence({ id: 2 });
    render(<Harness occurrences={[a, b]} stickyEventId={b.id} />);

    expect(opacityOf(a.title)).toBe("0");
    expect(opacityOf(b.title)).toBe("1");
  });

  it("al hacer blur la imagen NO vuelve atrás (no hay handler de salida)", () => {
    const a = makeOccurrence({ id: 1 });
    const b = makeOccurrence({ id: 2 });
    // La fijación ya sucedió (stickyEventId=b.id simula el estado tras el focus).
    render(<Harness occurrences={[a, b]} stickyEventId={b.id} />);

    fireEvent.blur(screen.getByRole("button", { name: b.title }));

    expect(opacityOf(b.title)).toBe("1");
    expect(opacityOf(a.title)).toBe("0");
  });
});

describe("CalendarCell — cumpleaños y puntos", () => {
  it("un día con solo cumpleaños no renderiza puntos en escritorio", () => {
    const birthday = makeBirthday({ id: 3 });
    render(<Harness occurrences={[birthday]} />);

    expect(screen.queryByRole("button", { name: birthday.title })).not.toBeInTheDocument();
  });

  it("un día con solo cumpleaños sí muestra la pastilla", () => {
    const birthday = makeBirthday({ id: 3, title: "Cumple de Ana" });
    render(<Harness occurrences={[birthday]} />);

    expect(screen.getByTitle("Cumple de Ana")).toBeInTheDocument();
  });
});

describe("CalendarCell — un solo evento", () => {
  it("no muestra puntos: la propia celda ya identifica ese evento", () => {
    const only = makeOccurrence({ id: 1 });
    render(<Harness occurrences={[only]} />);

    expect(screen.getByAltText(only.title)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: only.title })).not.toBeInTheDocument();
  });

});

describe("CalendarCell — clic sobre un punto", () => {
  it("abre el detalle de ese evento, no el del que se está mostrando", () => {
    const a = makeOccurrence({ id: 1 });
    const b = makeOccurrence({ id: 2 });
    const onEventSelect = vi.fn();
    render(<Harness occurrences={[a, b]} onEventSelect={onEventSelect} />);

    fireEvent.click(screen.getByRole("button", { name: b.title }));

    expect(onEventSelect).toHaveBeenCalledTimes(1);
    expect(onEventSelect).toHaveBeenCalledWith(b.id, expect.any(String));
  });
});

describe("CalendarCell — celda móvil", () => {
  it("marca hoy con relleno y el seleccionado con borde, simultáneamente si coinciden", () => {
    const madridToday = today("Europe/Madrid");
    render(<Harness occurrences={[]} targetDate={madridToday} isSelectedDay />);

    const label = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(
      madridToday.toDate("Europe/Madrid"),
    );
    const dayButton = screen.getByRole("button", { name: label });
    const daySpan = dayButton.querySelector("span");

    expect(daySpan?.className).toContain("bg-white/80");
    expect(daySpan?.className).toContain("border-white");
  });
});

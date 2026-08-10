import { describe, it, expect } from "vitest";
import type { EventOccurrence } from "@/types/events";
import {
  groupOccurrencesByDate,
  getDefaultOccurrence,
  getDesktopDotSequence,
  getMobileDotSequence,
} from "../eventOccurrences";

let nextId = 1;

function makeOccurrence(
  date: string,
  overrides: Partial<EventOccurrence> = {},
): EventOccurrence {
  const id = nextId++;
  return {
    id,
    occurrenceDate: date,
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
    ...overrides,
  };
}

function makeBirthday(date: string, overrides: Partial<EventOccurrence> = {}): EventOccurrence {
  return makeOccurrence(date, {
    eventType: {
      id: 2,
      code: "BIRTHDAY",
      name: "Cumpleaños",
      icon_path: "icons/birthday.svg",
      color: "rose-400",
    },
    ...overrides,
  });
}

describe("groupOccurrencesByDate", () => {
  it("agrupa por fecha preservando el orden de entrada", () => {
    const a = makeOccurrence("2026-06-01");
    const b = makeOccurrence("2026-06-01");
    const c = makeOccurrence("2026-06-02");

    const grouped = groupOccurrencesByDate([a, b, c]);

    expect(grouped.get("2026-06-01")).toEqual([a, b]);
    expect(grouped.get("2026-06-02")).toEqual([c]);
  });
});

describe("getDefaultOccurrence", () => {
  it("devuelve el primero según el orden del RPC", () => {
    const a = makeOccurrence("2026-06-01");
    const b = makeOccurrence("2026-06-01");
    expect(getDefaultOccurrence([a, b])).toBe(a);
  });

  it("devuelve null si el día no tiene eventos", () => {
    expect(getDefaultOccurrence([])).toBeNull();
  });
});

describe("secuencia de puntos de escritorio", () => {
  it("excluye los cumpleaños", () => {
    const birthday = makeBirthday("2026-06-01");
    const normal = makeOccurrence("2026-06-01");
    const { visible } = getDesktopDotSequence([birthday, normal]);
    expect(visible).toEqual([normal]);
  });

  it("un día solo con cumpleaños no genera ningún punto", () => {
    const birthday = makeBirthday("2026-06-01");
    const { visible, overflowCount } = getDesktopDotSequence([birthday]);
    expect(visible).toHaveLength(0);
    expect(overflowCount).toBe(0);
  });

  it("recorta a 6 puntos: con 7 eventos muestra 5 + 1 de resto", () => {
    const events = Array.from({ length: 7 }, (_, i) => makeOccurrence("2026-06-01", { title: `E${i}` }));
    const { visible, overflowCount } = getDesktopDotSequence(events);
    expect(visible).toHaveLength(5);
    expect(overflowCount).toBe(2);
  });

  it("con exactamente 6 eventos no hay desbordamiento", () => {
    const events = Array.from({ length: 6 }, (_, i) => makeOccurrence("2026-06-01", { title: `E${i}` }));
    const { visible, overflowCount } = getDesktopDotSequence(events);
    expect(visible).toHaveLength(6);
    expect(overflowCount).toBe(0);
  });
});

describe("secuencia de puntos de móvil", () => {
  // Los cumpleaños ya no generan punto en móvil: se representan con un
  // único destello en CalendarCell.tsx (ver ese componente), igual que en
  // escritorio se representan con la pastilla superior — en ningún caso
  // cuentan como un punto más de la secuencia.
  it("excluye los cumpleaños, igual que la secuencia de escritorio", () => {
    const normal = makeOccurrence("2026-06-01");
    const birthday = makeBirthday("2026-06-01");
    const dayOccurrences = [birthday, normal];

    const desktop = getDesktopDotSequence(dayOccurrences).visible;
    const mobile = getMobileDotSequence(dayOccurrences).visible;

    expect(desktop).toEqual([normal]);
    expect(mobile).toEqual([normal]);
  });

  it("un día solo con cumpleaños no genera ningún punto", () => {
    const birthday = makeBirthday("2026-06-01");
    const { visible, overflowCount } = getMobileDotSequence([birthday]);
    expect(visible).toHaveLength(0);
    expect(overflowCount).toBe(0);
  });
});

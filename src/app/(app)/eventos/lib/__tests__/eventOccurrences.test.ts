import { describe, it, expect } from "vitest";
import type { EventOccurrence } from "@/types/events";
import {
  daysCoveredBy,
  groupOccurrencesByDate,
  getDefaultOccurrence,
  getDesktopDotSequence,
  getMobileDotSequence,
  isPastOccurrence,
  lastDayOfOccurrence,
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
    eventDate: `${date}T00:00:00Z`,
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

  it("un evento de varios días entra en la lista de todos ellos", () => {
    const festival = makeOccurrence("2026-06-01", { endDate: "2026-06-03T20:00:00Z" });

    const grouped = groupOccurrencesByDate([festival]);

    expect([...grouped.keys()]).toEqual(["2026-06-01", "2026-06-02", "2026-06-03"]);
    for (const day of grouped.keys()) {
      expect(grouped.get(day)).toEqual([festival]);
    }
  });

  // El objeto es el mismo en todas las celdas y conserva su fecha de
  // inicio: de occurrenceDate salen la fecha del modal de detalle y el
  // enlace compartible, que deben apuntar al comienzo del evento aunque
  // se abra desde el último día.
  it("la ocurrencia repartida conserva su fecha de inicio", () => {
    const festival = makeOccurrence("2026-06-01", { endDate: "2026-06-03T20:00:00Z" });

    const grouped = groupOccurrencesByDate([festival]);

    expect(grouped.get("2026-06-03")?.[0].occurrenceDate).toBe("2026-06-01");
  });

  // Se recorre en el orden del RPC (por fecha de inicio), así que el
  // evento que ya venía de días atrás queda por delante del que empieza
  // ese día — y es el que la celda muestra por defecto.
  it("el evento que viene de atrás precede al que empieza ese día", () => {
    const festival = makeOccurrence("2026-06-01", { endDate: "2026-06-03T20:00:00Z" });
    const charla = makeOccurrence("2026-06-02");

    const grouped = groupOccurrencesByDate([festival, charla]);

    expect(grouped.get("2026-06-02")).toEqual([festival, charla]);
    expect(getDefaultOccurrence(grouped.get("2026-06-02") ?? [])).toBe(festival);
  });

  it("cruza el cambio de mes sin saltarse ningún día", () => {
    const puente = makeOccurrence("2026-06-29", { endDate: "2026-07-02T12:00:00Z" });

    const grouped = groupOccurrencesByDate([puente]);

    expect([...grouped.keys()]).toEqual([
      "2026-06-29",
      "2026-06-30",
      "2026-07-01",
      "2026-07-02",
    ]);
  });
});

describe("daysCoveredBy", () => {
  it("un evento sin fecha de fin ocupa un único día", () => {
    expect(daysCoveredBy(makeOccurrence("2026-08-18"))).toEqual(["2026-08-18"]);
  });

  // Las fechas de fin son instantes UTC y el día se cuenta en
  // Europe/Madrid: en agosto son dos horas de diferencia, así que las
  // 20:00Z de este evento son las 22:00 del mismo día ahí.
  it("una fecha de fin en el mismo día tampoco añade días", () => {
    const occurrence = makeOccurrence("2026-08-18", { endDate: "2026-08-18T20:00:00Z" });
    expect(daysCoveredBy(occurrence)).toEqual(["2026-08-18"]);
  });

  // Mismo criterio que lastDayOfOccurrence: en un evento anual end_date
  // conserva el año original, así que una fecha de fin anterior a la
  // ocurrencia no puede extenderla (ni, mucho menos, hacia atrás).
  it("un cumpleaños con end_date del año original sigue ocupando un día", () => {
    const birthday = makeBirthday("2026-03-04", { endDate: "1990-03-04T23:00:00Z" });
    expect(daysCoveredBy(birthday)).toEqual(["2026-03-04"]);
  });

  it("cruza el cambio de año", () => {
    const occurrence = makeOccurrence("2026-12-30", { endDate: "2027-01-01T10:00:00Z" });
    expect(daysCoveredBy(occurrence)).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
    ]);
  });

  // Salvaguarda contra una end_date con el año mal tecleado: la rejilla
  // nunca enseña más de 42 celdas, así que el tope no recorta nada
  // visible, solo evita decenas de miles de vueltas de bucle.
  it("no reparte más de un año de días por muy lejos que quede el fin", () => {
    const occurrence = makeOccurrence("2026-01-01", { endDate: "2260-01-01T10:00:00Z" });
    expect(daysCoveredBy(occurrence)).toHaveLength(366);
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
    const a = makeOccurrence("2026-06-01");
    const b = makeOccurrence("2026-06-01");
    const { visible } = getDesktopDotSequence([birthday, a, b]);
    expect(visible).toEqual([a, b]);
  });

  // Con un único evento la celda ya lo identifica por sí sola (imagen de
  // fondo y color del contorno) y no queda nada entre lo que navegar, así
  // que el punto suelto sobra. Móvil no comparte esta regla.
  it("un día con un único evento no genera ningún punto", () => {
    const only = makeOccurrence("2026-06-01");
    const { visible, overflowCount } = getDesktopDotSequence([only]);
    expect(visible).toHaveLength(0);
    expect(overflowCount).toBe(0);
  });

  it("los cumpleaños no cuentan como ese segundo evento que haría falta", () => {
    const birthday = makeBirthday("2026-06-01");
    const only = makeOccurrence("2026-06-01");
    expect(getDesktopDotSequence([birthday, only]).visible).toHaveLength(0);
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
    const birthday = makeBirthday("2026-06-01");
    const a = makeOccurrence("2026-06-01");
    const b = makeOccurrence("2026-06-01");
    const dayOccurrences = [birthday, a, b];

    const desktop = getDesktopDotSequence(dayOccurrences).visible;
    const mobile = getMobileDotSequence(dayOccurrences).visible;

    expect(desktop).toEqual([a, b]);
    expect(mobile).toEqual([a, b]);
  });

  // Única diferencia deliberada con escritorio: en móvil la celda no
  // muestra imagen, así que el punto de un día con un solo evento es el
  // ÚNICO indicio de que ese día tiene algo y no puede desaparecer.
  it("un día con un único evento SÍ conserva su punto", () => {
    const only = makeOccurrence("2026-06-01");
    expect(getMobileDotSequence([only]).visible).toEqual([only]);
    expect(getDesktopDotSequence([only]).visible).toHaveLength(0);
  });

  it("un día solo con cumpleaños no genera ningún punto", () => {
    const birthday = makeBirthday("2026-06-01");
    const { visible, overflowCount } = getMobileDotSequence([birthday]);
    expect(visible).toHaveLength(0);
    expect(overflowCount).toBe(0);
  });
});


describe("lastDayOfOccurrence", () => {
  it("sin fecha de fin, el último día es el de la ocurrencia", () => {
    expect(lastDayOfOccurrence(makeOccurrence("2026-08-18"))).toBe("2026-08-18");
  });

  it("con fecha de fin posterior, manda esa", () => {
    const occurrence = makeOccurrence("2026-08-18", { endDate: "2026-08-20T18:00:00Z" });
    expect(lastDayOfOccurrence(occurrence)).toBe("2026-08-20");
  });

  // En un evento anual end_date conserva el año original (1990 en un
  // cumpleaños), así que tomarla al pie de la letra dejaría el último día
  // décadas antes que la propia ocurrencia.
  it("una fecha de fin anterior a la ocurrencia se ignora", () => {
    const occurrence = makeOccurrence("2026-03-04", { endDate: "1990-03-04T23:00:00Z" });
    expect(lastDayOfOccurrence(occurrence)).toBe("2026-03-04");
  });
});

describe("isPastOccurrence", () => {
  const today = "2026-08-18";

  it("lo de ayer ya pasó", () => {
    expect(isPastOccurrence(makeOccurrence("2026-08-17"), today)).toBe(true);
  });

  // Un evento de hoy todavía está por delante: se puede marcar interés
  // hasta que termina el día.
  it("lo de hoy no ha pasado", () => {
    expect(isPastOccurrence(makeOccurrence(today), today)).toBe(false);
  });

  it("lo de mañana tampoco", () => {
    expect(isPastOccurrence(makeOccurrence("2026-08-19"), today)).toBe(false);
  });

  it("un evento de varios días sigue vivo mientras no acabe", () => {
    const occurrence = makeOccurrence("2026-08-15", { endDate: "2026-08-19T20:00:00Z" });
    expect(isPastOccurrence(occurrence, today)).toBe(false);
  });

  // Los cumpleaños son la única recurrencia del sistema (YEARLY): vuelven
  // cada año, así que ninguna ocurrencia suya cuenta como pasada.
  it("un cumpleaños de hace meses no cuenta como pasado", () => {
    expect(isPastOccurrence(makeBirthday("2026-03-04"), today)).toBe(false);
  });
});

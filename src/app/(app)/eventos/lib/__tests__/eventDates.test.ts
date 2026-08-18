import { describe, it, expect } from "vitest";
import { combineDateTime, isEndBeforeStart } from "../eventDates";

describe("combineDateTime", () => {
  it("sin hora, el instante es la medianoche de ese día", () => {
    const iso = combineDateTime("2026-06-15", null);
    expect(new Date(iso).getHours()).toBe(0);
    expect(new Date(iso).getMinutes()).toBe(0);
  });

  it("con hora, la respeta", () => {
    const iso = combineDateTime("2026-06-15", "18:30");
    expect(new Date(iso).getHours()).toBe(18);
    expect(new Date(iso).getMinutes()).toBe(30);
  });
});

describe("isEndBeforeStart", () => {
  const start = combineDateTime("2026-06-15", "18:00");

  it("sin fecha de fin no hay nada que comparar", () => {
    expect(isEndBeforeStart(start, null)).toBe(false);
  });

  it("un fin posterior es válido", () => {
    expect(isEndBeforeStart(start, combineDateTime("2026-06-16", "10:00"))).toBe(false);
  });

  it("un fin anterior en días no lo es", () => {
    expect(isEndBeforeStart(start, combineDateTime("2026-06-14", "23:00"))).toBe(true);
  });

  // El caso que hacía "revivir" el aviso: mismo día, hora de fin anterior.
  // Comparando solo las fechas esto pasaba por bueno en el formulario y lo
  // rechazaba el servidor con el mismo texto, como si no se hubiera
  // corregido nada.
  it("el mismo día con hora de fin anterior también es un fin anterior", () => {
    expect(isEndBeforeStart(start, combineDateTime("2026-06-15", "10:00"))).toBe(true);
  });

  it("terminar exactamente a la hora de inicio es válido", () => {
    expect(isEndBeforeStart(start, combineDateTime("2026-06-15", "18:00"))).toBe(false);
  });
});

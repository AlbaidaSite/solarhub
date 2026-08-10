import { describe, it, expect } from "vitest";
import { formatEventDateOnly, formatEventEndDate, formatEventTime, formatEventPrice } from "../formatting";

describe("formatEventDateOnly", () => {
  it("pinta dd/MM/yyyy a partir de occurrenceDate", () => {
    expect(formatEventDateOnly("2026-06-15")).toBe("15/06/2026");
  });

  it("usa la fecha proyectada (occurrenceDate), no el año del evento almacenado, para eventos anuales", () => {
    expect(formatEventDateOnly("2026-06-10")).toBe("10/06/2026");
  });
});

describe("formatEventEndDate", () => {
  it("sin fecha de fin, devuelve null", () => {
    expect(formatEventEndDate(null, true)).toBeNull();
  });

  it("con fecha de fin y hora incluida, pinta dd/MM/yyyy hh:mm", () => {
    expect(formatEventEndDate("2026-06-16T20:30:00Z", true)).toBe("16/06/2026 22:30");
  });

  it("con fecha de fin sin hora, pinta solo dd/MM/yyyy", () => {
    expect(formatEventEndDate("2026-06-16T00:00:00Z", false)).toBe("16/06/2026");
  });
});

describe("formatEventTime", () => {
  it("sin hora especificada, devuelve null", () => {
    expect(formatEventTime("2026-06-15T00:00:00Z", false)).toBeNull();
  });

  it("con hora especificada, devuelve hh:mm en Europe/Madrid", () => {
    expect(formatEventTime("2026-06-15T18:30:00Z", true)).toBe("20:30");
  });
});

describe("formatEventPrice", () => {
  it("formatea en es-ES/EUR", () => {
    expect(formatEventPrice(12.5)).toBe("12,50 €");
  });

  it("redondea a dos decimales", () => {
    expect(formatEventPrice(3)).toBe("3,00 €");
  });
});

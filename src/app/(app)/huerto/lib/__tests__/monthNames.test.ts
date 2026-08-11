import { describe, it, expect } from "vitest";
import { getMonthName, nextMonth, previousMonth } from "../monthNames";

describe("nextMonth / previousMonth", () => {
  it("de diciembre se pasa a enero", () => {
    expect(nextMonth(12)).toBe(1);
  });

  it("de enero hacia atrás se pasa a diciembre", () => {
    expect(previousMonth(1)).toBe(12);
  });

  it("en el resto de meses simplemente suma o resta uno", () => {
    expect(nextMonth(6)).toBe(7);
    expect(previousMonth(6)).toBe(5);
  });
});

describe("getMonthName", () => {
  it("devuelve el nombre del mes en español con mayúscula inicial", () => {
    expect(getMonthName(1)).toBe("Enero");
    expect(getMonthName(12)).toBe("Diciembre");
  });
});

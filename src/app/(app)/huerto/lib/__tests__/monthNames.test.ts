import { describe, it, expect } from "vitest";
import {
  formatMonthList,
  getMonthAbbr,
  getMonthName,
  nextMonth,
  previousMonth,
} from "../monthNames";

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

describe("getMonthAbbr", () => {
  // Tres letras siempre, también en septiembre: el "short" de Intl daría
  // "sept" y descuadraría el ancho de las celdas del selector.
  it("son siempre las tres primeras letras del nombre", () => {
    expect(getMonthAbbr(9)).toBe("Sep");
    expect(getMonthAbbr(1)).toBe("Ene");
  });
});

describe("formatMonthList", () => {
  it("junta los nombres por comas en orden natural, sin repetidos", () => {
    expect(formatMonthList([10, 3, 3])).toBe("Marzo, Octubre");
  });

  it("sin meses devuelve cadena vacía, tanto con null como con lista vacía", () => {
    expect(formatMonthList(null)).toBe("");
    expect(formatMonthList([])).toBe("");
  });
});

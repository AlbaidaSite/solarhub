import { describe, it, expect } from "vitest";
import { getMonthGridRange } from "../gridRange";

describe("getMonthGridRange", () => {
  it("mes que empieza en lunes no añade días de cola del mes anterior", () => {
    // 1 de abril de 2024 es lunes.
    expect(getMonthGridRange(2024, 4)).toEqual({
      start: "2024-04-01",
      end: "2024-05-05",
    });
  });

  it("añade días de cola del mes anterior cuando el 1 no cae en lunes", () => {
    // 1 de diciembre de 2024 es domingo → la rejilla empieza el lunes previo.
    expect(getMonthGridRange(2024, 12).start).toBe("2024-11-25");
  });

  it("la rejilla puede cruzar frontera de año (diciembre → enero)", () => {
    const range = getMonthGridRange(2024, 12);
    expect(range).toEqual({ start: "2024-11-25", end: "2025-01-05" });
  });
});

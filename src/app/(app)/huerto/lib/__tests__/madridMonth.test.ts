import { describe, it, expect, vi, afterEach } from "vitest";
import { getCurrentMonthInMadrid } from "../madridMonth";

describe("getCurrentMonthInMadrid", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("00:30 del 1 de febrero en Madrid ya es febrero aunque en UTC siga siendo enero", () => {
    // 2026-01-31T23:30:00Z = 2026-02-01T00:30:00+01:00 (CET)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-31T23:30:00Z"));
    expect(getCurrentMonthInMadrid()).toBe(2);
  });

  it("00:30 del 1 de julio en Madrid (CEST, UTC+2) ya es julio", () => {
    // 2026-06-30T22:30:00Z = 2026-07-01T00:30:00+02:00 (CEST)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T22:30:00Z"));
    expect(getCurrentMonthInMadrid()).toBe(7);
  });
});

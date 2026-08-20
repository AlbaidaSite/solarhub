import { describe, it, expect, vi, afterEach } from "vitest";
import { eventTypeClasses } from "../eventTypeClasses";

describe("eventTypeClasses — formato válido", () => {
  it("compone dot/pill/badge a partir del mismo valor literal", () => {
    expect(eventTypeClasses("amber-400")).toEqual({
      dot: "bg-amber-400",
      pill: "bg-amber-400",
      badgeBg: "bg-amber-400/20",
      badgeBorder: "border-amber-400",
    });
  });

  it("acepta cualquier matiz de la paleta completa de Tailwind", () => {
    expect(eventTypeClasses("emerald-500").dot).toBe("bg-emerald-500");
  });
});

describe("eventTypeClasses — formato inválido", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("cae a un color neutro si falta el tono", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(eventTypeClasses("amber").dot).toBe("bg-zinc-400");
  });

  it("cae a un color neutro si el tono no tiene 3 dígitos", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(eventTypeClasses("amber-40").dot).toBe("bg-zinc-400");
  });

  it("cae a un color neutro si es un hex antiguo", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(eventTypeClasses("#ffb300").dot).toBe("bg-zinc-400");
  });
});

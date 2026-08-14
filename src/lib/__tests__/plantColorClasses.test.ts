import { describe, it, expect, vi, afterEach } from "vitest";
import { plantColorClasses } from "../plantColorClasses";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("plantColorClasses — valores válidos", () => {
  it("compone las tres clases sobre el mismo valor literal", () => {
    expect(plantColorClasses("red-700")).toEqual({
      text: "text-red-700",
      border: "border-red-700",
      bg: "bg-red-700",
    });
  });

  it("acepta cualquier matiz cromático de Tailwind, rose incluido", () => {
    expect(plantColorClasses("rose-700").text).toBe("text-rose-700");
    expect(plantColorClasses("fuchsia-50").text).toBe("text-fuchsia-50");
  });
});

describe("plantColorClasses — fallback", () => {
  it("una planta sin color usa el neutro, sin quejarse", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(plantColorClasses(null).text).toBe("text-zinc-400");
    expect(error).not.toHaveBeenCalled();
  });

  it("un matiz que no existe en Tailwind cae al neutro y avisa", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // "olive" suena a color pero no está en la paleta de Tailwind: sin
    // este control generaría la clase text-olive-400, que no existe, y el
    // cultivo se quedaría sin pintar en vez de usar el neutro.
    expect(plantColorClasses("olive-400").text).toBe("text-zinc-400");
    expect(error).toHaveBeenCalledOnce();
  });

  it("un valor con formato incorrecto cae al neutro y avisa", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(plantColorClasses("#ff0000").bg).toBe("bg-zinc-400");
    expect(plantColorClasses("red").bg).toBe("bg-zinc-400");
    expect(error).toHaveBeenCalledTimes(2);
  });
});

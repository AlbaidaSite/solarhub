// SUT: src/middleware.ts → config.matcher
// El webhook de Bunny no trae sesión: si el middleware lo procesara, lo
// redirigiría a /login (307) y nunca llegaría al route handler. Solo esa
// ruta exacta queda fuera; el resto sigue protegido.

import { describe, it, expect } from "vitest";
import { config } from "@/middleware";

const matcher = new RegExp(`^${config.matcher[0]}$`);

describe("middleware · matcher", () => {
  it("excluye el webhook de Bunny", () => {
    expect(matcher.test("/api/webhooks/bunny")).toBe(false);
  });

  it.each(["/", "/mapa", "/mapa/nueva", "/api/webhooks/bunny-otro", "/api/webhooks/otro"])(
    "sigue protegiendo %s",
    (path) => {
      expect(matcher.test(path)).toBe(true);
    },
  );

  it("sigue excluyendo los estáticos", () => {
    expect(matcher.test("/media/img/logoW.png")).toBe(false);
    expect(matcher.test("/_next/static/chunk.js")).toBe(false);
  });
});

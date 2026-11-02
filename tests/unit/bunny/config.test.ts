// SUT: src/lib/bunny/env.ts + config.ts
// La configuración de Bunny se lee en tiempo de petición: importar config.ts
// sin variables no puede lanzar (pnpm build y CI no las tienen); llamar a
// getBunnyConfig() sí, con la lista de las que faltan.

import { describe, it, expect, afterEach, vi } from "vitest";
import { BunnyConfigError, parseBunnyEnv } from "@/lib/bunny/env";

const FULL_ENV = {
  BUNNY_STREAM_LIBRARY_ID: "12345",
  BUNNY_STREAM_API_KEY: "api",
  BUNNY_STREAM_READONLY_API_KEY: "ro",
  BUNNY_STREAM_TOKEN_KEY: "tok",
  NEXT_PUBLIC_BUNNY_CDN_HOSTNAME: "vz-abc.b-cdn.net",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseBunnyEnv", () => {
  it("devuelve solo las claves pedidas", () => {
    expect(parseBunnyEnv(FULL_ENV, ["libraryId", "apiKey"])).toEqual({
      libraryId: "12345",
      apiKey: "api",
    });
  });

  it("lanza BunnyConfigError con todas las que faltan (vacías incluidas)", () => {
    try {
      parseBunnyEnv({ BUNNY_STREAM_API_KEY: "  " }, ["libraryId", "apiKey"]);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(BunnyConfigError);
      expect((err as BunnyConfigError).missing).toEqual([
        "BUNNY_STREAM_LIBRARY_ID",
        "BUNNY_STREAM_API_KEY",
      ]);
    }
  });
});

describe("getBunnyConfig", () => {
  it("importar el módulo sin variables no lanza; llamarlo sí", async () => {
    for (const key of Object.keys(FULL_ENV)) vi.stubEnv(key, "");
    const { getBunnyConfig } = await import("@/lib/bunny/config");
    expect(() => getBunnyConfig()).toThrow(BunnyConfigError);
  });

  it("con las cinco variables devuelve la configuración", async () => {
    for (const [key, value] of Object.entries(FULL_ENV)) vi.stubEnv(key, value);
    const { getBunnyConfig } = await import("@/lib/bunny/config");
    expect(getBunnyConfig()).toEqual({
      libraryId: "12345",
      apiKey: "api",
      readonlyApiKey: "ro",
      tokenKey: "tok",
      cdnHostname: "vz-abc.b-cdn.net",
    });
  });
});

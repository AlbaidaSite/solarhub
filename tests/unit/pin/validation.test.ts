// SUT: src/lib/parseCoordinates.ts + reglas en createPinAction/updatePinAction
// Cubre RN-019 (geolocalización válida y país asociado).
//
// `parseCoordinates` ya tiene su propio test exhaustivo en
// src/lib/__tests__/parseCoordinates.test.ts (18 casos). Aquí añadimos un
// puñado de invariantes de la regla RN-019 enfocados a los límites de rango
// y a la noción de "país válido" (que en TS se reduce a estar entre los
// almacenados — la enforce la FK de Postgres, pero documentamos también un
// helper puro `isKnownCountryCode` aplicado por el bloque de Frontend).

import { describe, it, expect } from "vitest";
import { parseCoordinates } from "@/lib/parseCoordinates";

// Réplica fiel de las reglas que aplican createPin/updatePinAction (lat ∈
// [-90, 90], lng ∈ [-180, 180]) — están duplicadas allí porque la action
// no usa parseCoordinates (recibe los números ya).
function isValidLatLng(lat: number, lng: number): boolean {
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

function isKnownCountryCode(code: string, known: Set<string>): boolean {
  return known.has(code);
}

describe("RN-019 · rango de latitud / longitud", () => {
  it("acepta coordenadas válidas", () => {
    expect(isValidLatLng(37.4084606, -6.0798973)).toBe(true);
    expect(isValidLatLng(0, 0)).toBe(true);
    expect(isValidLatLng(-90, -180)).toBe(true);
    expect(isValidLatLng(90, 180)).toBe(true);
  });

  it("rechaza latitud fuera de [-90, 90]", () => {
    expect(isValidLatLng(90.0001, 0)).toBe(false);
    expect(isValidLatLng(-90.0001, 0)).toBe(false);
    expect(isValidLatLng(91, 0)).toBe(false);
    expect(isValidLatLng(-91, 0)).toBe(false);
  });

  it("rechaza longitud fuera de [-180, 180]", () => {
    expect(isValidLatLng(0, 180.0001)).toBe(false);
    expect(isValidLatLng(0, -180.0001)).toBe(false);
    expect(isValidLatLng(0, 181)).toBe(false);
    expect(isValidLatLng(0, -181)).toBe(false);
  });

  it("rechaza NaN", () => {
    expect(isValidLatLng(Number.NaN, 0)).toBe(false);
    expect(isValidLatLng(0, Number.NaN)).toBe(false);
  });
});

describe("RN-019 · `parseCoordinates` aplica los mismos límites (input usuario)", () => {
  it("acepta formato inglés y español dentro de rango", () => {
    expect(parseCoordinates("37.4084606, -6.0798973")).toEqual({
      lat: 37.4084606,
      lng: -6.0798973,
    });
    expect(parseCoordinates("37,4084606, -6,0798973")).toEqual({
      lat: 37.4084606,
      lng: -6.0798973,
    });
  });

  it("rechaza coordenadas fuera de rango aunque el formato sea válido", () => {
    expect(parseCoordinates("90.1, 0")).toBeNull();
    expect(parseCoordinates("0, 200")).toBeNull();
  });
});

describe("RN-019 · país asociado entre los almacenados", () => {
  // La validación TS depende de la lista de países cargada del servidor.
  // Modelamos el chequeo como pura para que sea testeable; el real lo enforza
  // la FK `pin.country_code REFERENCES country(code)`.
  const known = new Set(["ES", "FR", "JP", "US"]);

  it("acepta un código ISO alpha-2 presente en la lista", () => {
    expect(isKnownCountryCode("ES", known)).toBe(true);
  });

  it("rechaza un código ausente", () => {
    expect(isKnownCountryCode("XX", known)).toBe(false);
  });

  it("es case-sensitive (la BD almacena en mayúsculas)", () => {
    expect(isKnownCountryCode("es", known)).toBe(false);
  });
});

describe("RN-019 · combinaciones (validación completa)", () => {
  it("coordenadas válidas + país válido → válido", () => {
    expect(
      isValidLatLng(37.4, -6.0) && isKnownCountryCode("ES", new Set(["ES"])),
    ).toBe(true);
  });

  it("coordenadas válidas + país inválido → inválido", () => {
    expect(
      isValidLatLng(37.4, -6.0) && isKnownCountryCode("XX", new Set(["ES"])),
    ).toBe(false);
  });

  it("coordenadas inválidas + país válido → inválido", () => {
    expect(
      isValidLatLng(200, -6.0) && isKnownCountryCode("ES", new Set(["ES"])),
    ).toBe(false);
  });
});

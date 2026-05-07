import { describe, it, expect } from "vitest";
import { parseCoordinates } from "../parseCoordinates";

describe("parseCoordinates — éxito", () => {
  it("formato inglés estándar", () => {
    expect(parseCoordinates("37.4084606, -6.0798973")).toEqual({
      lat: 37.4084606,
      lng: -6.0798973,
    });
  });

  it("formato español estándar", () => {
    expect(parseCoordinates("37,4084606, -6,0798973")).toEqual({
      lat: 37.4084606,
      lng: -6.0798973,
    });
  });

  it("espacios extra al inicio/final", () => {
    expect(parseCoordinates("  37.4084606, -6.0798973  ")).toEqual({
      lat: 37.4084606,
      lng: -6.0798973,
    });
  });

  it("valores enteros (formato inglés)", () => {
    expect(parseCoordinates("40, -3")).toEqual({ lat: 40, lng: -3 });
  });

  it("latitud negativa", () => {
    expect(parseCoordinates("-33.8688, 151.2093")).toEqual({
      lat: -33.8688,
      lng: 151.2093,
    });
  });

  it("coordenadas en límite exacto: lat=90, lng=180", () => {
    expect(parseCoordinates("90, 180")).toEqual({ lat: 90, lng: 180 });
  });

  it("coordenadas en límite exacto: lat=-90, lng=-180", () => {
    expect(parseCoordinates("-90, -180")).toEqual({ lat: -90, lng: -180 });
  });
});

describe("parseCoordinates — fallo", () => {
  it("latitud fuera de rango (> 90)", () => {
    expect(parseCoordinates("95, 0")).toBeNull();
  });

  it("latitud fuera de rango (< -90)", () => {
    expect(parseCoordinates("-91, 0")).toBeNull();
  });

  it("longitud fuera de rango (> 180)", () => {
    expect(parseCoordinates("0, 200")).toBeNull();
  });

  it("longitud fuera de rango (< -180)", () => {
    expect(parseCoordinates("0, -181")).toBeNull();
  });

  it("formato sin comas", () => {
    expect(parseCoordinates("37.4084606 -6.0798973")).toBeNull();
  });

  it("valores no numéricos", () => {
    expect(parseCoordinates("abc, def")).toBeNull();
  });

  it("string vacío", () => {
    expect(parseCoordinates("")).toBeNull();
  });

  it("sólo espacios", () => {
    expect(parseCoordinates("   ")).toBeNull();
  });

  it("dos comas (ambiguo: no es ni 1 ni 3)", () => {
    expect(parseCoordinates("37.408, -6.079, extra")).toBeNull();
  });

  it("cuatro comas", () => {
    expect(parseCoordinates("37,40,8606, -6,07,973")).toBeNull();
  });

  it("split español produce más de 2 partes", () => {
    // Si ", " aparece más de una vez (3 comas pero split da 3 partes), debe fallar
    expect(parseCoordinates("37,40, -6,07, 0")).toBeNull();
  });
});

// SUT: src/app/(app)/cromos/lib/visibility.ts
// Cubre RN-012, RN-013 y la cláusula superuser de RF-009.

import { describe, it, expect } from "vitest";
import { isVisibleInAlbum } from "@/app/(app)/cromos/lib/visibility";
import {
  labelsAbierto,
  labelsForLoukou,
  labelsHidden,
  labelsForLoukouHidden,
} from "../../fixtures/cromos";

describe("RN-012 / RN-013 · isVisibleInAlbum", () => {
  it("cromo sin restricciones es visible para cualquier usuario", () => {
    expect(isVisibleInAlbum(labelsAbierto, false, false, false)).toBe(true);
  });

  it("cromo for_loukou se oculta a usuario estándar que no lo tuvo", () => {
    expect(isVisibleInAlbum(labelsForLoukou, false, false, false)).toBe(false);
  });

  it("cromo for_loukou es visible para un loukou aunque nunca lo tuviese", () => {
    expect(isVisibleInAlbum(labelsForLoukou, false, true, false)).toBe(true);
  });

  it("RN-012 (excepción): usuario estándar que SÍ tuvo el cromo for_loukou lo sigue viendo", () => {
    expect(isVisibleInAlbum(labelsForLoukou, true, false, false)).toBe(true);
  });

  it("cromo hide_til_registered se oculta al usuario que nunca lo registró", () => {
    expect(isVisibleInAlbum(labelsHidden, false, false, false)).toBe(false);
  });

  it("cromo hide_til_registered se hace visible tras haber registrado al menos una copia", () => {
    expect(isVisibleInAlbum(labelsHidden, true, false, false)).toBe(true);
  });

  it("cromo for_loukou + hide_til_registered se hace visible cuando se tiene", () => {
    expect(isVisibleInAlbum(labelsForLoukouHidden, true, false, false)).toBe(true);
  });

  it("RN-012 (excepción): un cromo que el usuario TUVO y luego intercambió sigue siendo visible", () => {
    // hasEverOwned = true se construye desde TODO el historial sin filtrar
    // por is_current_owner — eso es el "incluso tras haberlo intercambiado".
    const hadButTradedAway = true;
    expect(isVisibleInAlbum(labelsForLoukou, hadButTradedAway, false, false)).toBe(true);
  });

  it("superuser ve cualquier cromo (modo dios)", () => {
    expect(isVisibleInAlbum(labelsForLoukouHidden, false, false, true)).toBe(true);
    expect(isVisibleInAlbum(labelsHidden, false, false, true)).toBe(true);
  });

  it("loukou que tiene hide_til_registered sin registrar no lo ve", () => {
    // hide_til_registered es ortogonal a for_loukou: requiere posesión.
    expect(isVisibleInAlbum(labelsHidden, false, true, false)).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { moveItem, nearestIndex } from "../reorder";

describe("moveItem", () => {
  it("mueve hacia abajo desplazando a los de en medio", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("mueve hacia arriba", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("no toca la lista si el destino es el mismo sitio", () => {
    const list = ["a", "b", "c"];
    expect(moveItem(list, 1, 1)).toBe(list);
  });

  it("recorta el destino al rango de la lista", () => {
    expect(moveItem(["a", "b"], 0, 9)).toEqual(["b", "a"]);
    expect(moveItem(["a", "b"], 1, -3)).toEqual(["b", "a"]);
  });

  it("un origen inexistente devuelve la lista original", () => {
    const list = ["a"];
    expect(moveItem(list, 5, 0)).toBe(list);
  });
});

describe("nearestIndex", () => {
  const midpoints = [10, 30, 50];

  it("devuelve la fila cuyo centro está más cerca", () => {
    expect(nearestIndex(midpoints, 12)).toBe(0);
    expect(nearestIndex(midpoints, 26)).toBe(1);
    expect(nearestIndex(midpoints, 100)).toBe(2);
  });

  it("por encima o por debajo de todo se queda en los extremos", () => {
    expect(nearestIndex(midpoints, -50)).toBe(0);
    expect(nearestIndex(midpoints, 999)).toBe(2);
  });

  it("en un empate gana la primera, que es donde ya estaba", () => {
    expect(nearestIndex([10, 30], 20)).toBe(0);
  });

  it("una lista vacía no revienta", () => {
    expect(nearestIndex([], 5)).toBe(0);
  });
});

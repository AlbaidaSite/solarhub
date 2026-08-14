// Saca el elemento de `from` y lo mete en `to`, desplazando al resto.
// Devuelve una lista nueva; si los índices no cambian nada, la original.
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const target = Math.min(Math.max(to, 0), list.length - 1);
  if (target === from) return list;

  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

// Índice de la fila cuyo centro queda más cerca de `y`. Se trabaja con
// los centros ya medidos (y no con una altura fija) porque las filas del
// listado no miden todas lo mismo: las que tienen tipo/descripción son
// más altas. Empate -> la primera, que es la que ya estaba antes.
export function nearestIndex(midpoints: number[], y: number): number {
  if (midpoints.length === 0) return 0;

  let best = 0;
  let bestDistance = Math.abs(midpoints[0] - y);
  for (let i = 1; i < midpoints.length; i++) {
    const distance = Math.abs(midpoints[i] - y);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  }
  return best;
}

"use client";

import { codeToBits } from "@/scripts/generator";

interface CodeGridPreviewProps {
  code: number;
  // Tamaño de cada celda en `tailwind units` (1 = 4px).
  // Por defecto 3 → 12px/celda → ~45px de grid total.
  cellSize?: number;
}

// Mismo lenguaje visual que RegisterCromoButton: grid 4x4 de anillos
// solapados 1px (= ancho del borde) y un núcleo iluminado en las celdas
// activas. Aquí "activa" = bit a 1 en la representación binaria del code
// (complemento a 2). cell 0 = bit 15 (signo), cell 15 = bit 0.
export default function CodeGridPreview({ code, cellSize = 3 }: CodeGridPreviewProps) {
  const bits = codeToBits(code);

  const sizeClass = cellSize === 2 ? "w-2 h-2" : cellSize === 4 ? "w-4 h-4" : "w-3 h-3";

  return (
    <span
      aria-label={`Vista previa del code ${code}`}
      className="inline-grid grid-cols-4 text-cyan-700 shrink-0"
    >
      {bits.map((bit, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const isActive = bit === 1;
        return (
          <span
            key={i}
            className={`relative block ${sizeClass}
              ${col > 0 ? "-ml-px" : ""}
              ${row > 0 ? "-mt-px" : ""}`}
          >
            {isActive && (
              <span className="absolute inset-0.5 rounded-full bg-indigo-200 shadow-[0_0_5px_#fff] z-10" />
            )}
            <span className="absolute inset-0 rounded-full border-2 border-current opacity-100" />
          </span>
        );
      })}
    </span>
  );
}

"use client";

import Link from "next/link";

interface RegisterCromoButtonProps {
  className?: string;
}

// Mapeo del patrón solicitado:
// [0,1,0,0] -> índices 1
// [1,0,1,1] -> índices 4, 6, 7
// [0,1,0,0] -> índice 9
// [1,0,1,0] -> índices 12, 14
const ACTIVE_INDICES = [1, 4, 6, 7, 9, 12, 14];
const CELLS_COUNT = 16;

export default function RegisterCromoButton({
  className = "",
}: RegisterCromoButtonProps) {
  return (
    <Link
      href="/cromos/registrar"
      aria-label="Registrar cromo nuevo"
      title="Registrar cromo"
      className={`items-center justify-center p-2 rounded-full text-cyan-600 hover:text-cyan-500 hover:bg-white/5 transition-colors ${className}`}
    >
      <span aria-hidden className="inline-grid grid-cols-4">
        {Array.from({ length: CELLS_COUNT }).map((_, i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const isActive = ACTIVE_INDICES.includes(i);

          return (
            <span
              key={i}
              className={`relative block w-2 h-2
                ${col > 0 ? "-ml-px" : ""}
                ${row > 0 ? "-mt-px" : ""}`}
            >
              {/* Núcleo: Blanco con brillo si está en el patrón */}
              {isActive && (
                <span className="absolute inset-0.5 rounded-full bg-indigo-200 shadow-[0_0_5px_#fff] z-10" />
              )}
              
              {/* Contorno: Siempre encendido en el color del tema (blue-400) */}
              <span className="absolute inset-0 rounded-full border-2 border-current opacity-100" />
            </span>
          );
        })}
      </span>
    </Link>
  );
}
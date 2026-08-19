"use client";

import { Droplet } from "lucide-react";
import type { GardenBoard } from "@/types/garden";

interface BoardToggleProps {
  board: GardenBoard;
  onChange: (board: GardenBoard) => void;
}

// Mismo panel con datos distintos, no paneles independientes: no es
// role="tab". Estructura calcada del conmutador de AuthView.tsx
// (src/app/(auth)/components/AuthView.tsx), sin el medallón del sol.
//
// El riego va primero y solo con icono: es una lectura distinta del
// huerto, no un tercer modo de cultivos, y separarlo visualmente de las
// dos palabras ayuda a que no se lea como "Riego / Actual / Planificar"
// (tres cosas del mismo tipo). Actual sigue siendo el valor de partida.
export default function BoardToggle({ board, onChange }: BoardToggleProps) {
  const isIrrigation = board.kind === "irrigation";

  return (
    <div className="flex items-center justify-center gap-5">
      <button
        type="button"
        aria-pressed={isIrrigation}
        aria-label="Riego"
        title="Riego"
        onClick={() => onChange({ kind: "irrigation" })}
        className={`transition-colors cursor-pointer ${
          isIrrigation ? "text-sky-400" : "text-sky-400/40 hover:text-sky-400/70"
        }`}
      >
        <Droplet size={28} strokeWidth={2.5} />
      </button>

      <Separator />

      <ToggleButton
        active={board.kind === "crops" && board.mode === "actual"}
        onClick={() => onChange({ kind: "crops", mode: "actual" })}
      >
        Actual
      </ToggleButton>

      <Separator />

      <ToggleButton
        active={board.kind === "crops" && board.mode === "planificada"}
        onClick={() => onChange({ kind: "crops", mode: "planificada" })}
      >
        Planificar
      </ToggleButton>
    </div>
  );
}

function Separator() {
  return (
    <span aria-hidden className="text-zinc-600 text-2xl">
      /
    </span>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`text-2xl font-bold transition-colors cursor-pointer ${
        active ? "text-white" : "text-white/40 hover:text-white/70"
      }`}
    >
      {children}
    </button>
  );
}

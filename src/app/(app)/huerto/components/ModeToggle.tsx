"use client";

import type { GardenMode } from "@/types/garden";

interface ModeToggleProps {
  mode: GardenMode;
  onChange: (mode: GardenMode) => void;
}

// Mismo panel con datos distintos, no dos paneles independientes: no
// es role="tab". Estructura calcada del conmutador de AuthView.tsx
// (src/app/(auth)/components/AuthView.tsx), sin el medallón del sol.
export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex items-center justify-center gap-5">
      <ToggleButton active={mode === "actual"} onClick={() => onChange("actual")}>
        Actual
      </ToggleButton>
      <span aria-hidden className="text-zinc-600 text-2xl">
        /
      </span>
      <ToggleButton active={mode === "planificada"} onClick={() => onChange("planificada")}>
        Planificar
      </ToggleButton>
    </div>
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
      className={`text-2xl font-bold transition-colors ${
        active ? "text-white" : "text-white/40 hover:text-white/70"
      }`}
    >
      {children}
    </button>
  );
}

"use client";

import { getMonthAbbr, getMonthName } from "../lib/monthNames";

interface MonthPickerProps {
  // Va en la leyenda del grupo: "Meses de siembra", "Meses de recolecta".
  legend: string;
  months: number[];
  onChange: (months: number[]) => void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

// Los doce meses como casillas, no como <select multiple>: se marcan
// varios de un vistazo y en móvil no hace falta pelearse con ctrl+clic.
// La casilla real está oculta (sr-only) pero sigue siendo la que recibe
// foco y teclado; lo que se ve es su <label>, que cambia de color al
// estar marcada.
export default function MonthPicker({ legend, months, onChange }: MonthPickerProps) {
  const selected = new Set(months);

  const toggle = (m: number) => {
    const next = new Set(selected);
    if (next.has(m)) {
      next.delete(m);
    } else {
      next.add(m);
    }
    onChange([...next].sort((a, b) => a - b));
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold text-white/70">{legend}</legend>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {MONTHS.map((m) => {
          const isSelected = selected.has(m);
          return (
            <label
              key={m}
              className={`flex items-center justify-center rounded-lg border px-2 py-1.5 text-sm transition-colors cursor-pointer ${
                isSelected
                  ? "border-amber-300/60 bg-amber-300/15 text-amber-200"
                  : "border-white/15 text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(m)}
                // El nombre accesible es el mes completo aunque se vean
                // solo tres letras: "Mar" no se lee igual en un lector de
                // pantalla que "Marzo".
                aria-label={getMonthName(m)}
                className="sr-only"
              />
              {getMonthAbbr(m)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

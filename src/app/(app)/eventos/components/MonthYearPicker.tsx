"use client";

import { useState } from "react";
import { CalendarDate } from "@internationalized/date";
import type { CalendarState } from "react-stately";
import Triangle from "./Triangle";

const ARROW_CLASS =
  "text-white transition-colors hover:text-amber-300 disabled:opacity-30 disabled:hover:text-white disabled:cursor-default cursor-pointer";

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat("es-ES", { month: "long" }).format(new Date(2000, i, 1)),
);

interface MonthYearPickerProps {
  state: CalendarState;
  onClose: () => void;
}

// Panel de selección directa de mes/año, para saltar sin tener que pulsar
// "mes siguiente" repetidamente. `state.setFocusedDate` mueve el rango
// visible del calendario igual que lo haría la navegación con flechas.
export default function MonthYearPicker({ state, onClose }: MonthYearPickerProps) {
  const [pickerYear, setPickerYear] = useState(state.visibleRange.start.year);

  function selectMonth(monthIndex: number) {
    state.setFocusedDate(new CalendarDate(pickerYear, monthIndex + 1, 1));
    onClose();
  }

  return (
    <div className="absolute top-full left-1/2 z-20 mt-2 w-64 -translate-x-1/2 rounded-lg border border-white/15 bg-zinc-900 p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => setPickerYear((y) => y - 1)}
          aria-label="Año anterior"
          className={ARROW_CLASS}
        >
          <Triangle direction="left" />
        </button>
        <span className="text-sm font-semibold">{pickerYear}</span>
        <button
          type="button"
          onClick={() => setPickerYear((y) => y + 1)}
          aria-label="Año siguiente"
          className={ARROW_CLASS}
        >
          <Triangle direction="right" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {MONTH_NAMES.map((name, i) => {
          const isCurrent =
            pickerYear === state.visibleRange.start.year && i + 1 === state.visibleRange.start.month;
          return (
            <button
              key={name}
              type="button"
              onClick={() => selectMonth(i)}
              className={`rounded px-2 py-1.5 text-sm capitalize transition-colors ${
                isCurrent
                  ? "bg-amber-300/15 text-amber-200"
                  : "text-white/80 hover:bg-white/5 hover:text-white"
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

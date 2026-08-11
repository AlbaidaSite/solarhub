"use client";

import { getMonthName } from "../lib/monthNames";

interface MonthSelectProps {
  month: number;
  onChange: (month: number) => void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

// <select> nativo en vez de un listbox propio: en móvil da la rueda
// del sistema gratis y es accesible sin escribir nada.
export default function MonthSelect({ month, onChange }: MonthSelectProps) {
  return (
    <select
      aria-label="Mes"
      value={month}
      onChange={(e) => onChange(Number(e.target.value))}
      className="bg-transparent text-2xl font-bold underline decoration-1 underline-offset-4 cursor-pointer"
    >
      {MONTHS.map((m) => (
        <option key={m} value={m} className="bg-black text-white">
          {getMonthName(m)}
        </option>
      ))}
    </select>
  );
}

"use client";

import { useState } from "react";
import { preventEnterSubmit } from "@/lib/preventEnterSubmit";
import { MAX_SOW_YEAR, MIN_SOW_YEAR } from "../lib/diary";
import type { CropDiaryEntry } from "@/types/garden";

interface DiaryEntryFormProps {
  // Entrada que se está editando; ausente al crear una nueva.
  editing?: CropDiaryEntry | null;
  // Año con el que nace una entrada nueva: el actual en Madrid.
  defaultYear: number;
  isPending: boolean;
  error: string | null;
  onSubmit: (values: { sowYear: number; notes: string }) => void;
  onCancel: () => void;
}

// Alta y edición comparten formulario, igual que en CropForm: editar es lo
// mismo con los valores actuales precargados desde el estado inicial (nada
// de efectos que los sincronicen después).
export default function DiaryEntryForm({
  editing,
  defaultYear,
  isPending,
  error,
  onSubmit,
  onCancel,
}: DiaryEntryFormProps) {
  const [year, setYear] = useState<number | "">(editing?.sow_year ?? defaultYear);
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (year === "" || notes.trim() === "") return;
    onSubmit({ sowYear: year, notes });
  };

  return (
    <form onSubmit={submit} onKeyDown={preventEnterSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-white/70">Año de siembra</span>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value === "" ? "" : Number(e.target.value))}
          min={MIN_SOW_YEAR}
          max={MAX_SOW_YEAR}
          required
          className="rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-white"
        />
        <span className="text-xs text-white/40">
          El diario se ordena por este año; puede haber varias entradas del mismo.
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-white/70">Notas</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          required
          placeholder="Cómo fue la temporada, qué se probó, qué hay que cambiar…"
          className="rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-white placeholder:text-white/30"
        />
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending || year === "" || notes.trim() === ""}
          className="flex-1 rounded-xl bg-white/10 px-4 py-2 font-semibold text-white transition-colors hover:bg-white/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Guardando…" : editing ? "Guardar cambios" : "Añadir"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="flex-1 rounded-xl bg-white/5 px-4 py-2 font-semibold text-white/80 transition-colors hover:bg-white/10 cursor-pointer disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

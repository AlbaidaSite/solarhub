"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Trash2, X } from "lucide-react";
import { registerCromoAction } from "@/app/(app)/cromos/registrar/actions";
import { cromoPath } from "@/app/(app)/cromos/lib/slug";
import { CELL_COUNT, computeCode } from "@/app/(app)/cromos/lib/code";
import FilterIconButton from "./FilterIconButton";
import type { Category } from "@/types/cromo";

// Lado de la rejilla 4x4 dentro del modal. Ya no es un número fijo de
// píxeles por celda: crece con el hueco real —ancho del modal y alto de
// la ventana— igual que en la vista completa de registrar, y se queda
// corto antes que desbordar. Los desplazamientos de -3px que solapan los
// anillos son del grosor del borde, no del tamaño de la celda, así que
// esto escala sin tocarlos.
const GRID_SIDE = "clamp(11rem, min(70vw, 100dvh - 24rem), 20rem)";

type SubmitActionResult =
  | { ok: true; idSlug?: string; uniqueId: number }
  | { ok: false; error: string };

interface InlineRegisterModalProps {
  categories: Category[];
  onClose: () => void;
  // Si se pasa onSuccess, se llama tras un envío correcto en lugar de mostrar
  // el botón "Ir a Cromo". Útil para flujos donde el unique resultante debe
  // usarse en otra acción (p.ej. añadirlo a una oferta).
  onSuccess?: (idSlug: string | null, uniqueId: number) => void;
  submitLabel?: string;
  title?: string;
  // Acción personalizada. Por defecto registra el cromo (crea ownership).
  // Otros flujos (p.ej. "Añadir con código") sólo verifican propiedad.
  submitAction?: (categoryId: number, code: number) => Promise<SubmitActionResult>;
}

export default function InlineRegisterModal({
  categories,
  onClose,
  onSuccess,
  submitLabel = "Registrar",
  title = "Registrar cromo",
  submitAction,
}: InlineRegisterModalProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [cells, setCells]     = useState<boolean[]>(() => Array(CELL_COUNT).fill(false));
  const [lastIdSlug, setLastIdSlug] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const code        = useMemo(() => computeCode(cells), [cells]);
  const hasSelection = cells.some(Boolean);
  const canSubmit   = selectedCategoryId !== null && hasSelection && !isPending;

  const toggleCell = (i: number) => {
    setCells((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
    setMessage(null);
  };

  const clearGrid = () => {
    setCells(Array(CELL_COUNT).fill(false));
    setMessage(null);
  };

  const handleRegister = () => {
    if (isPending || !hasSelection) return;
    if (selectedCategoryId === null) {
      setMessage({ tone: "error", text: "Selecciona la categoría primero." });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = submitAction
        ? await submitAction(selectedCategoryId, code)
        : await registerCromoAction(selectedCategoryId, code);
      if (result.ok) {
        setCells(Array(CELL_COUNT).fill(false));
        if (onSuccess) {
          // Flujo derivado (p.ej. añadir a oferta): el caller decide qué hacer.
          onSuccess(result.idSlug ?? null, result.uniqueId);
        } else {
          setLastIdSlug(result.idSlug ?? null);
          setMessage({ tone: "success", text: "Cromo registrado correctamente." });
        }
      } else {
        setMessage({ tone: "error", text: result.error });
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border border-white/15 rounded-2xl p-6 max-w-md sm:max-w-lg w-full flex flex-col gap-5 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-red-300/70 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={32} />
          </button>
        </div>

        {/* Categorías */}
        <div className="flex flex-wrap justify-center gap-2">
          {categories.map((c) => (
            <FilterIconButton
              key={c.id}
              iconUrl={c.icon_path}
              label={c.name}
              active={selectedCategoryId === c.id}
              size="lg"
              onClick={() => {
                setSelectedCategoryId(c.id);
                setMessage(null);
                setLastIdSlug(null);
              }}
            />
          ))}
        </div>

        {/* Grid 4x4 compacto */}
        <div className="relative mx-auto" style={{ width: GRID_SIDE }}>
          {/* Botones */}
          <div className="grid grid-cols-4">
            {cells.map((on, i) => {
              const col = i % 4;
              const row = Math.floor(i / 4);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleCell(i)}
                  aria-pressed={on}
                  style={{ transform: `translate(${-3 * col}px, ${-3 * row}px)` }}
                  className={`aspect-square rounded-full cursor-pointer transition-colors ${
                    on ? "bg-indigo-300 hover:bg-sky-300" : "bg-zinc-800/40 hover:bg-zinc-700/60"
                  }`}
                />
              );
            })}
          </div>
          {/* Anillos */}
          <div aria-hidden className="absolute inset-0 grid grid-cols-4 pointer-events-none">
            {cells.map((on, i) => {
              const col = i % 4;
              const row = Math.floor(i / 4);
              return (
                <span
                  key={i}
                  style={{ transform: `translate(${-3 * col}px, ${-3 * row}px)` }}
                  className={`aspect-square rounded-full border-[3px] transition-all duration-150 ${
                    on ? "z-10 border-cyan-700" : "border-cyan-900"
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Mensaje */}
        {message && (
          <p className={`text-center text-xs ${message.tone === "error" ? "text-red-400" : "text-emerald-400"}`}>
            {message.text}
          </p>
        )}

        {/* Botones */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleRegister}
            disabled={!canSubmit}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:cursor-not-allowed text-zinc-900 font-bold text-sm shadow transition-colors cursor-pointer"
          >
            {isPending ? "Registrando…" : submitLabel}
          </button>

          <button
            type="button"
            onClick={clearGrid}
            aria-label="Limpiar"
            className="p-2 rounded-full text-white/50 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Trash2 size={18} strokeWidth={2.5} />
          </button>

          {lastIdSlug && (
            <Link
              href={cromoPath(lastIdSlug)}
              className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-sm shadow transition-colors"
              onClick={onClose}
            >
              Ir a Cromo
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

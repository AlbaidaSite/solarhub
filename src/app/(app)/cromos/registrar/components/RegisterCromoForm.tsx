"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import CornerButton from "@/components/ui/CornerButton";
import FilterIconButton from "../../components/FilterIconButton";
import { cromoPath } from "../../lib/slug";
import { CELL_COUNT, computeCode } from "../../lib/code";
import { registerCromoAction } from "../actions";
import type { Category } from "@/types/cromo";

interface RegisterCromoFormProps {
  categories: Category[];
}

export default function RegisterCromoForm({ categories }: RegisterCromoFormProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [cells, setCells] = useState<boolean[]>(() => Array(CELL_COUNT).fill(false));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [lastIdSlug, setLastIdSlug] = useState<string | null>(null);

  const code = useMemo(() => computeCode(cells), [cells]);
  const hasSelection = cells.some(Boolean);
  const canClick = hasSelection && !isSubmitting;

  const toggleCell = (i: number) => {
    setCells((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
    setMessage(null);
  };

  const clearGrid = () => {
    setCells(Array(CELL_COUNT).fill(false));
    setMessage(null);
  };

  const handleCategoryChange = (id: number) => {
    setSelectedCategoryId(id);
    setMessage(null);
    setLastIdSlug(null);
  };

  const onRegister = async () => {
    if (isSubmitting || !hasSelection) return;
    if (selectedCategoryId === null) {
      setMessage({
        tone: "error",
        text: "Por favor, seleccione la categoría a la que pertenezca el cromo.",
      });
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    const result = await registerCromoAction(selectedCategoryId, code);
    setIsSubmitting(false);
    if (result.ok) {
      setCells(Array(CELL_COUNT).fill(false));
      setLastIdSlug(result.idSlug);
      setMessage({ tone: "success", text: "Cromo registrado correctamente." });
    } else {
      setMessage({ tone: "error", text: result.error });
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-8 pb-12">
      {/* Categorías */}
      <div className="flex flex-wrap justify-center gap-3 px-4">
        {categories.map((c) => (
          <FilterIconButton
            key={c.id}
            iconUrl={c.icon_path}
            label={c.name}
            active={selectedCategoryId === c.id}
            size="lg"
            onClick={() => handleCategoryChange(c.id)}
          />
        ))}
      </div>

      {/* Grid 4x4 — dos capas independientes:
          · Capa inferior: 16 botones a tamaño completo de la celda.
          · Capa superior: 16 anillos decorativos no clickables.
          Los botones pueden sobresalir del hueco interior del anillo;
          la capa de anillos (encima, con pointer-events-none) garantiza
          que el contorno del grid quede siempre íntegro y sin huecos. */}
      <div className="relative w-60 max-w-xs">
        {/* Capa 1 — Botones (debajo, clickables) */}
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
                aria-label={`Celda ${i + 1}`}
                style={{ transform: `translate(${-4 * col}px, ${-4 * row}px)` }}
                className={`aspect-square rounded-full cursor-pointer transition-colors ${
                  on
                    ? "bg-indigo-200 hover:bg-sky-300"
                    : "bg-zinc-800/40 hover:bg-zinc-700/60"
                }`}
              />
            );
          })}
        </div>

        {/* Capa 2 — Anillos (encima, decorativos) */}
        <div
          aria-hidden
          className="absolute inset-0 grid grid-cols-4 pointer-events-none"
        >
          {cells.map((on, i) => {
            const col = i % 4;
            const row = Math.floor(i / 4);
            return (
              <span
                key={i}
                style={{ transform: `translate(${-4 * col}px, ${-4 * row}px)` }}
                className={`aspect-square rounded-full border-4 transition-all duration-150 ${
                  "border-cyan-700"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Mensaje */}
      {message && (
        <p
          role="status"
          className={`text-chip text-center max-w-md px-4 ${
            message.tone === "error" ? "text-red-400" : "text-amber-300"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* Botones */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <CornerButton type="button" onClick={onRegister} disabled={!canClick}>
          {isSubmitting ? "Registrando…" : "Registrar"}
        </CornerButton>

        <button
          type="button"
          onClick={clearGrid}
          aria-label="Limpiar selección"
          title="Limpiar selección"
          className="p-3 rounded-full text-white/70 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer"
        >
          <Trash2 size={22} strokeWidth={2.5} />
        </button>

        {lastIdSlug !== null && (
          <CornerButton
            type="button"
            // Hard nav (window.location) en vez de router.push: queremos
            // que el usuario aterrice en la ruta canónica /cromos/[idSlug]
            // (full page), no en la versión modal que activaría el
            // intercepting route si fuese soft nav desde /cromos/registrar.
            onClick={() => {
              window.location.assign(cromoPath(lastIdSlug));
            }}
          >
            Ir a Cromo
          </CornerButton>
        )}
      </div>

      
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useDialog, FocusScope } from "react-aria";
import { Check, X } from "lucide-react";
import { IRRIGATION_LEVELS, irrigationInfo } from "../lib/irrigation";
import { setIrrigationLevelAction } from "../actions";
import type { GardenBed, IrrigationLevel } from "@/types/garden";

interface IrrigationModalProps {
  bed: GardenBed;
  level: IrrigationLevel | undefined;
  onClose: () => void;
  onLevelChange: (bedId: number, level: IrrigationLevel) => void;
}

// Selector del nivel de riego de un bancal. A diferencia de BedModal, el
// telón NO oscurece ni desenfoca lo que hay detrás: el lienzo se sigue
// viendo entero mientras se elige, que es justo lo que da contexto (qué
// bancal se está tocando y cómo está el riego de sus vecinos).
//
// El telón transparente sigue estando, y no es decorativo: es lo que
// recoge el clic fuera para cerrar. Sin él, sin fondo visible al que
// apuntar, la única salida sería la tecla Escape.
export default function IrrigationModal({
  bed,
  level,
  onClose,
  onLevelChange,
}: IrrigationModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { dialogProps, titleProps } = useDialog({}, dialogRef);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const current = irrigationInfo(level).level;

  const handleSelect = (next: IrrigationLevel) => {
    // Elegir el que ya está puesto es cerrar: no hay nada que guardar y
    // gastar una escritura para dejar la fila igual sobra.
    if (next === current) {
      onClose();
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await setIrrigationLevelAction(bed.id, next);
      if (result.ok) {
        onLevelChange(bed.id, result.row.irrigation_level);
        onClose();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <FocusScope contain restoreFocus autoFocus>
        <div
          {...dialogProps}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="irrigation-modal-title"
          // Este sí lleva fondo propio y opaco: es lo único que lo separa
          // del lienzo, que queda a la vista justo detrás.
          className="w-full max-w-xs rounded-2xl border border-white/15 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              id="irrigation-modal-title"
              {...titleProps}
              className="text-lg font-bold text-white"
            >
              {bed.name}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 rounded-full p-1 text-red-300/70 transition-colors hover:bg-white/5 hover:text-amber-300 cursor-pointer"
            >
              <X size={22} />
            </button>
          </div>

          <ul className="mt-3 flex flex-col gap-2">
            {IRRIGATION_LEVELS.map((info) => {
              const isCurrent = info.level === current;
              return (
                <li key={info.level}>
                  <button
                    type="button"
                    onClick={() => handleSelect(info.level)}
                    disabled={isPending}
                    aria-pressed={isCurrent}
                    className={`flex w-full items-center gap-3 rounded-xl border p-2 transition-colors cursor-pointer disabled:opacity-50 ${
                      isCurrent
                        ? "border-white/40 bg-white/5"
                        : "border-white/15 hover:border-white/30"
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10">
                      <info.Icon size={24} strokeWidth={2.5} className={info.text} />
                    </span>
                    <span className="flex-1 text-left font-medium text-white">{info.label}</span>
                    {/* El check no es la única señal de cuál está puesto
                        (el borde y el fondo también lo dicen), pero es la
                        que no depende de distinguir dos grises. */}
                    {isCurrent && <Check size={18} className="shrink-0 text-white/60" />}
                  </button>
                </li>
              );
            })}
          </ul>

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-400">
              {error}
            </p>
          )}
        </div>
      </FocusScope>
    </div>
  );
}

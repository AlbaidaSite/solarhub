"use client";

import type { ReactNode } from "react";

// Tokens de estilo compartidos entre todos los formularios de staff. Aplicar
// la misma clase a inputs/selects/textareas garantiza coherencia visual sin
// duplicar la cadena de Tailwind en cada campo.
export const FIELD_CLASS =
  "w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm placeholder-white/40 focus:outline-none focus:border-amber-300 transition-colors";

export const LABEL_CLASS =
  "text-xs font-semibold text-white/70 uppercase tracking-wide";

// Misma etiqueta, un par de puntos más grande. Los formularios de sticker la
// usan porque son cortos (nombre + icono) y el rótulo en text-xs quedaba
// perdido al lado del campo.
export const LABEL_CLASS_LG =
  "text-sm md:text-base font-semibold text-white/70 uppercase tracking-wide";

interface FieldProps {
  label: string;
  // Permite sustituir LABEL_CLASS por otra variante (p.ej. LABEL_CLASS_LG).
  labelClassName?: string;
  children: ReactNode;
}

// Envuelve un input/select/textarea con su etiqueta superior en mayúsculas.
export function Field({
  label,
  labelClassName = LABEL_CLASS,
  children,
}: FieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelClassName}>{label}</span>
      {children}
    </label>
  );
}

interface SubmitButtonProps {
  isPending: boolean;
  pendingLabel?: string;
  children: ReactNode;
}

// Botón de submit ámbar con estado pending y disabled.
export function SubmitButton({
  isPending,
  pendingLabel = "Guardando…",
  children,
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={isPending}
      className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:cursor-not-allowed text-zinc-900 font-bold shadow transition-colors cursor-pointer"
    >
      {isPending ? pendingLabel : children}
    </button>
  );
}

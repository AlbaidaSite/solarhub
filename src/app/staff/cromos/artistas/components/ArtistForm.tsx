"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ArtistActionResult } from "../actions";

interface ArtistFormProps {
  initial?: { name: string; url: string };
  // La action recibe formData y devuelve el resultado.
  // Se acepta con cualquier número de argumentos iniciales via bind().
  action: (formData: FormData) => Promise<ArtistActionResult>;
  submitLabel: string;
}

const FIELD_CLASS =
  "w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm placeholder-white/40 focus:outline-none focus:border-amber-300 transition-colors";
const LABEL_CLASS = "text-xs font-semibold text-white/70 uppercase tracking-wide";

export default function ArtistForm({ initial, action, submitLabel }: ArtistFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(fd);
      if (result.ok) {
        router.push("/staff/cromos/artistas");
      } else {
        // El error se muestra via alert temporal; un estado de formulario
        // más completo puede añadirse si se necesita.
        alert(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-md w-full">
      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>Nombre *</span>
        <input
          type="text"
          name="name"
          defaultValue={initial?.name ?? ""}
          required
          className={FIELD_CLASS}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>URL</span>
        <input
          type="url"
          name="url"
          defaultValue={initial?.url ?? ""}
          placeholder="https://…"
          className={FIELD_CLASS}
        />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:cursor-not-allowed text-zinc-900 font-bold shadow transition-colors cursor-pointer"
      >
        {isPending ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}

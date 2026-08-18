"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, FIELD_CLASS, SubmitButton } from "../../../components/form";
import type { ArtistActionResult } from "../actions";

interface ArtistFormProps {
  initial?: { name: string; url: string };
  // La action recibe formData y devuelve el resultado. Se acepta con cualquier
  // argumento inicial bindeado (p.ej. el id en edición).
  action: (formData: FormData) => Promise<ArtistActionResult>;
  submitLabel: string;
}

export default function ArtistForm({
  initial,
  action,
  submitLabel,
}: ArtistFormProps) {
  const router = useRouter();
  // Estado normal en vez de useTransition: el router.push() de dentro
  // mantendría la transición pendiente hasta que cargue el destino, y una
  // navegación atascada dejaría el botón en "Guardando…" con el artista ya
  // guardado. Sigue puesto al navegar, para no enviar dos veces.
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setIsPending(true);
    const result = await action(fd);
    if (!result.ok) {
      alert(result.error);
      setIsPending(false);
      return;
    }
    router.push("/staff/cromos/artistas");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 max-w-md w-full"
    >
      <Field label="Nombre *">
        <input
          type="text"
          name="name"
          defaultValue={initial?.name ?? ""}
          required
          className={FIELD_CLASS}
        />
      </Field>

      <Field label="URL">
        <input
          type="url"
          name="url"
          defaultValue={initial?.url ?? ""}
          placeholder="https://…"
          className={FIELD_CLASS}
        />
      </Field>

      <SubmitButton isPending={isPending}>{submitLabel}</SubmitButton>
    </form>
  );
}

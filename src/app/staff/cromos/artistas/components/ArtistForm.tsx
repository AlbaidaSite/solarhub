"use client";

import { useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(fd);
      if (result.ok) {
        router.push("/staff/cromos/artistas");
      } else {
        alert(result.error);
      }
    });
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

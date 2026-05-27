"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImageIcon } from "lucide-react";
import {
  Field,
  FIELD_CLASS,
  LABEL_CLASS,
  SubmitButton,
} from "../../components/form";
import type { StickerActionResult } from "../actions";

interface StickerFormProps {
  existingIconUrl?: string;
  initial?: { name: string };
  action: (formData: FormData) => Promise<StickerActionResult>;
  submitLabel: string;
}

export default function StickerForm({
  existingIconUrl,
  initial,
  action,
  submitLabel,
}: StickerFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    // El input file está oculto, por lo que el `required` del navegador no
    // muestra el popup de validación. Comprobamos aquí en JS para que el
    // usuario reciba un aviso visible.
    if (!isEditing && !previewUrl) {
      setFormError("Debes seleccionar una imagen.");
      return;
    }

    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(fd);
      if (result.ok) {
        router.push("/staff/mapa");
      } else {
        setFormError(result.error);
      }
    });
  };

  const displayIcon = previewUrl ?? existingIconUrl;
  const isEditing = !!existingIconUrl;

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

      <div className="flex flex-col gap-2">
        <span className={LABEL_CLASS}>
          Icono{isEditing ? " (dejar vacío para conservar el actual)" : " *"}
        </span>

        <div
          onClick={() => fileRef.current?.click()}
          className="w-24 h-24 rounded-xl border-2 border-dashed border-white/20 hover:border-amber-300/60 bg-white/5 flex items-center justify-center cursor-pointer overflow-hidden transition-colors"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
          aria-label="Seleccionar imagen"
        >
          {displayIcon ? (
            <div className="relative w-full h-full">
              <Image
                src={displayIcon}
                alt="Icono del sticker"
                fill
                className="object-contain p-1"
                unoptimized
              />
            </div>
          ) : (
            <ImageIcon size={32} className="text-white/30" />
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          name="icon"
          accept="image/webp,image/png,image/jpeg,image/svg+xml,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="self-start text-xs text-amber-300 hover:text-amber-200 transition-colors cursor-pointer"
        >
          {displayIcon ? "Cambiar imagen" : "Seleccionar imagen"}
        </button>
      </div>

      {formError && (
        <p className="text-sm text-red-400 whitespace-pre-line">{formError}</p>
      )}

      <SubmitButton isPending={isPending}>{submitLabel}</SubmitButton>
    </form>
  );
}

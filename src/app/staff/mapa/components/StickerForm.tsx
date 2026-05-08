"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImageIcon } from "lucide-react";
import type { StickerActionResult } from "../actions";

interface StickerFormProps {
  existingIconUrl?: string;
  initial?: { name: string };
  action: (formData: FormData) => Promise<StickerActionResult>;
  submitLabel: string;
}

const FIELD_CLASS =
  "w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm placeholder-white/40 focus:outline-none focus:border-amber-300 transition-colors";
const LABEL_CLASS = "text-xs font-semibold text-white/70 uppercase tracking-wide";

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
    if (!file) { setPreviewUrl(null); return; }
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
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
          {...(!isEditing && { required: true })}
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
        <p className="text-sm text-red-400">{formError}</p>
      )}

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

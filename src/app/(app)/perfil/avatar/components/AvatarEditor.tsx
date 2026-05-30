"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, RotateCcw, Upload } from "lucide-react";

import CornerButton from "@/components/ui/CornerButton";
import { updateAvatarAction } from "../../actions";

// El recuadro de recorte (en px de pantalla). Lo que quede dentro se exporta.
const FRAME = 320;
// Tamaño final que se guarda en la base de datos.
const OUTPUT_SIZE = 512;
const MAX_ZOOM = 4;
const WEBP_QUALITY = 0.9;
const MAX_INPUT_BYTES = 25 * 1024 * 1024; // 25 MB de imagen de origen

interface Offset {
  x: number;
  y: number;
}

// Carga un File de imagen como HTMLImageElement, convirtiendo HEIC/HEIF a JPEG
// (algunos móviles entregan HEIC, que el navegador no decodifica de serie).
// Devuelve también el object URL: NO se revoca aquí porque sigue siendo el
// `src` del <img> de previsualización; la revocación la gestiona el componente
// al reemplazar la imagen o desmontarse.
async function loadImageElement(
  file: File,
): Promise<{ img: HTMLImageElement; url: string }> {
  let blob: Blob = file;

  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.(heic|heif)$/i.test(file.name);

  if (isHeic) {
    const heic2any = (await import("heic2any")).default as (opts: {
      blob: Blob;
      toType?: string;
      quality?: number;
    }) => Promise<Blob | Blob[]>;
    const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    blob = Array.isArray(result) ? result[0] : result;
  }

  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("No se pudo leer la imagen."));
      el.src = url;
    });
    return { img, url };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

export default function AvatarEditor() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);
  // Object URL vivo de la imagen actual, para revocarlo al reemplazar/desmontar.
  const objectUrlRef = useRef<string | null>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [loadingImage, setLoadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  // Escala mínima para que la imagen "cubra" el recuadro (object-fit: cover).
  const baseScale = image
    ? Math.max(FRAME / image.naturalWidth, FRAME / image.naturalHeight)
    : 1;
  const scale = baseScale * zoom;
  const dispW = image ? image.naturalWidth * scale : 0;
  const dispH = image ? image.naturalHeight * scale : 0;
  const maxOffsetX = Math.max(0, (dispW - FRAME) / 2);
  const maxOffsetY = Math.max(0, (dispH - FRAME) / 2);

  const clampOffset = useCallback(
    (o: Offset): Offset => ({
      x: Math.min(maxOffsetX, Math.max(-maxOffsetX, o.x)),
      y: Math.min(maxOffsetY, Math.max(-maxOffsetY, o.y)),
    }),
    [maxOffsetX, maxOffsetY],
  );

  // Reajusta el desplazamiento cuando cambia el zoom para no dejar huecos.
  useEffect(() => {
    setOffset((o) => clampOffset(o));
  }, [clampOffset]);

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
      setError("El archivo no es una imagen.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("La imagen es demasiado grande (máx. 25 MB).");
      return;
    }
    setLoadingImage(true);
    try {
      const { img, url } = await loadImageElement(file);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = url;
      setImage(img);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la imagen.");
    } finally {
      setLoadingImage(false);
    }
  }, []);

  const clearImage = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setImage(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // Revoca el object URL pendiente al desmontar el editor.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  };

  // ── Arrastrar para reposicionar (mouse y táctil vía Pointer Events) ──
  const onPointerDown = (e: React.PointerEvent) => {
    dragOrigin.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragOrigin.current) return;
    const dx = e.clientX - dragOrigin.current.x;
    const dy = e.clientY - dragOrigin.current.y;
    dragOrigin.current = { x: e.clientX, y: e.clientY };
    setOffset((o) => clampOffset({ x: o.x + dx, y: o.y + dy }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragOrigin.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onWheel = (e: React.WheelEvent) => {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(1, z - e.deltaY * 0.001)));
  };

  // Exporta el recuadro visible a un .webp de 512x512.
  const exportWebp = useCallback((): Promise<File> => {
    return new Promise((resolve, reject) => {
      if (!image) return reject(new Error("No hay imagen."));
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas no disponible."));

      // Región de la imagen original (en px naturales) que ocupa el recuadro.
      const srcSize = FRAME / scale;
      const srcX = (dispW / 2 - FRAME / 2 - offset.x) / scale;
      const srcY = (dispH / 2 - FRAME / 2 - offset.y) / scale;

      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        image,
        srcX,
        srcY,
        srcSize,
        srcSize,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("No se pudo generar la imagen."));
          resolve(new File([blob], "avatar.webp", { type: "image/webp" }));
        },
        "image/webp",
        WEBP_QUALITY,
      );
    });
  }, [image, scale, dispW, dispH, offset]);

  const handleSave = () => {
    setError(null);
    startSaving(async () => {
      try {
        const file = await exportWebp();
        const fd = new FormData();
        fd.append("avatar", file);
        const result = await updateAvatarAction(fd);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push("/perfil");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar.");
      }
    });
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-md -mt-6">
        <Link
          href="/perfil"
          className="inline-flex items-center gap-1 text-white/60 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft size={16} /> Volver al perfil
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-white mb-8">Foto de perfil</h1>

      {!image ? (
        <div className="w-full max-w-md flex flex-col gap-3 mb-8">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Soltar imagen aquí o pulsar para seleccionar"
            className="flex flex-col items-center justify-center gap-2 py-16 px-4 border-2 border-dashed border-white/20 rounded-2xl hover:border-amber-300/50 hover:bg-white/5 transition-colors cursor-pointer"
          >
            {loadingImage ? (
              <Loader2 size={32} className="text-amber-300 animate-spin" />
            ) : (
              <Upload size={32} className="text-white/50" />
            )}
            <p className="text-sm text-white/60 text-center">
              Arrastra una imagen aquí o{" "}
              <span className="text-amber-300 underline">explora tus archivos</span>
            </p>
            <p className="text-xs text-white/30">JPEG, PNG, WebP, GIF o HEIC</p>
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </div>
      ) : (
        <div className="w-full max-w-md flex flex-col items-center gap-6">
          {/* Recuadro de recorte */}
          <div
            className="relative overflow-hidden rounded-2xl bg-zinc-900 touch-none select-none cursor-grab active:cursor-grabbing"
            style={{ width: FRAME, height: FRAME }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={objectUrlRef.current ?? image.src}
              alt="Recorte de la foto de perfil"
              draggable={false}
              className="absolute max-w-none pointer-events-none"
              style={{
                width: dispW,
                height: dispH,
                left: FRAME / 2 + offset.x - dispW / 2,
                top: FRAME / 2 + offset.y - dispH / 2,
              }}
            />
            {/* Guía circular: así se ve cómo quedará el avatar (siempre redondo). */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
            />
          </div>

          {/* Control de zoom */}
          <label className="w-full flex items-center gap-3 text-white/60 text-sm">
            Zoom
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-amber-300 cursor-pointer"
            />
          </label>

          <p className="text-xs text-white/30 text-center">
            Arrastra para reposicionar · usa el zoom para ampliar
          </p>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={clearImage}
              disabled={isSaving}
              className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCcw size={16} /> Cambiar imagen
            </button>

            <CornerButton type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Guardando…" : "Guardar"}
            </CornerButton>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

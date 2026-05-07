"use client";

import { useCallback, useRef } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Film,
  ImageIcon,
  Loader2,
  Upload,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MediaStatus = "processing" | "ready" | "error";

export interface MediaEntry {
  clientId: string;
  originalName: string;
  mediaType: "PHOTO" | "VIDEO";
  /** Processed blob (compressed image or original video). Null while processing. */
  processedBlob: Blob | null;
  processedSize: number;
  /** Object URL or data-URL for the preview image. */
  previewUrl: string;
  status: MediaStatus;
  errorMsg: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILES = 5;
const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function detectMediaType(file: File): "PHOTO" | "VIDEO" | null {
  const mime = file.type.toLowerCase();
  if (mime.startsWith("image/") || /\.(heic|heif|jpg|jpeg|png|webp|gif)$/i.test(file.name)) {
    return "PHOTO";
  }
  if (mime.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name)) {
    return "VIDEO";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Video thumbnail (first frame via hidden canvas). Returns empty string on failure.
// ---------------------------------------------------------------------------

async function extractVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;

    const done = (dataUrl: string) => {
      URL.revokeObjectURL(url);
      resolve(dataUrl);
    };

    const drawFrame = () => {
      try {
        const w = Math.min(video.videoWidth || 320, 320);
        const h = video.videoHeight
          ? Math.round((video.videoHeight / video.videoWidth) * w)
          : 180;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
        done(canvas.toDataURL("image/jpeg", 0.6));
      } catch {
        done("");
      }
    };

    video.addEventListener(
      "loadedmetadata",
      () => {
        video.currentTime = 0.1;
      },
      { once: true }
    );
    video.addEventListener("seeked", drawFrame, { once: true });
    video.addEventListener("error", () => done(""), { once: true });
    // Safety timeout: some codecs never fire seeked on certain browsers
    setTimeout(() => done(""), 6000);
  });
}

// ---------------------------------------------------------------------------
// Image processing: HEIC → JPEG (if needed) + compress + strip EXIF via canvas
// ---------------------------------------------------------------------------

let _canWebP: boolean | null = null;
function supportsWebPOutput(): boolean {
  if (_canWebP !== null) return _canWebP;
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    _canWebP = c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    _canWebP = false;
  }
  return _canWebP;
}

async function processImageFile(file: File): Promise<File> {
  let workFile: File = file;

  // HEIC/HEIF → JPEG via heic2any
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
    const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
    const converted = Array.isArray(result) ? result[0] : result;
    workFile = new File(
      [converted],
      file.name.replace(/\.(heic|heif)$/i, ".jpg"),
      { type: "image/jpeg" }
    );
  }

  // Compress + resize + strip EXIF (canvas re-encode inherently discards EXIF)
  const { default: compress } = await import("browser-image-compression");
  const compressed = await compress(workFile, {
    maxWidthOrHeight: 2560,
    useWebWorker: true,
    fileType: supportsWebPOutput() ? "image/webp" : "image/jpeg",
    initialQuality: 0.85,
  });

  return compressed;
}

// ---------------------------------------------------------------------------
// Process one entry: returns the fields to update on MediaEntry
// ---------------------------------------------------------------------------

type ProcessResult = Pick<
  MediaEntry,
  "processedBlob" | "processedSize" | "previewUrl" | "status" | "errorMsg"
>;

async function processEntry(file: File, mediaType: "PHOTO" | "VIDEO"): Promise<ProcessResult> {
  try {
    if (mediaType === "PHOTO") {
      const processed = await processImageFile(file);
      if (processed.size > MAX_SIZE_BYTES) {
        return {
          processedBlob: null,
          processedSize: 0,
          previewUrl: "",
          status: "error",
          errorMsg: "Demasiado grande (máx. 15 MB)",
        };
      }
      const previewUrl = URL.createObjectURL(processed);
      return {
        processedBlob: processed,
        processedSize: processed.size,
        previewUrl,
        status: "ready",
        errorMsg: null,
      };
    } else {
      // Videos: no compression, just size check + thumbnail
      if (file.size > MAX_SIZE_BYTES) {
        return {
          processedBlob: null,
          processedSize: 0,
          previewUrl: "",
          status: "error",
          errorMsg: "Demasiado grande (máx. 15 MB)",
        };
      }
      const previewUrl = await extractVideoThumbnail(file);
      return {
        processedBlob: file,
        processedSize: file.size,
        previewUrl,
        status: "ready",
        errorMsg: null,
      };
    }
  } catch (err) {
    return {
      processedBlob: null,
      processedSize: 0,
      previewUrl: "",
      status: "error",
      errorMsg: err instanceof Error ? err.message : "Error al procesar el archivo",
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MediaSectionProps {
  entries: MediaEntry[];
  onAdd: (newEntries: MediaEntry[]) => void;
  onRemove: (clientId: string) => void;
  onUpdate: (clientId: string, changes: Partial<MediaEntry>) => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MediaSection({
  entries,
  onAdd,
  onRemove,
  onUpdate,
  disabled = false,
}: MediaSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = MAX_FILES - entries.length;
  const atMax = remaining <= 0;

  const handleFiles = useCallback(
    async (files: File[]) => {
      const toProcess = files.slice(0, remaining);
      if (toProcess.length === 0) return;

      // Build initial entries immediately so the UI shows placeholders
      const initial: MediaEntry[] = toProcess.map((file) => {
        const mediaType = detectMediaType(file);
        return {
          clientId: crypto.randomUUID(),
          originalName: file.name,
          mediaType: mediaType ?? "PHOTO",
          processedBlob: null,
          processedSize: 0,
          previewUrl: "",
          status: mediaType ? ("processing" as const) : ("error" as const),
          errorMsg: mediaType ? null : "Tipo de archivo no permitido",
        };
      });
      onAdd(initial);

      // Process each file asynchronously
      for (let i = 0; i < toProcess.length; i++) {
        const file = toProcess[i];
        const entry = initial[i];
        if (entry.status === "error") continue;
        const result = await processEntry(file, entry.mediaType);
        onUpdate(entry.clientId, result);
      }
    },
    [remaining, onAdd, onUpdate]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled || atMax) return;
    handleFiles(Array.from(e.dataTransfer.files));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    handleFiles(Array.from(e.target.files));
    // Reset so the same file can be re-added after removal
    e.target.value = "";
  };

  const openPicker = () => {
    if (!disabled && !atMax) inputRef.current?.click();
  };

  return (
    <fieldset>
      <legend className="text-sm font-medium text-zinc-400 mb-3">
        Multimedia{" "}
        <span className="text-zinc-500 font-normal">(opcional)</span>
      </legend>

      {/* Drop zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={openPicker}
        onKeyDown={(e) => e.key === "Enter" && openPicker()}
        role="button"
        tabIndex={disabled || atMax ? -1 : 0}
        aria-label="Soltar archivos aquí o pulsar para seleccionar"
        className={`
          flex flex-col items-center justify-center gap-2 py-8 px-4
          border-2 border-dashed rounded-xl transition-colors
          ${
            atMax || disabled
              ? "border-white/10 opacity-40 cursor-not-allowed"
              : "border-white/20 hover:border-amber-300/50 hover:bg-white/5 cursor-pointer"
          }
        `}
      >
        <Upload size={28} className="text-white/50" />
        <p className="text-sm text-white/60 text-center">
          Arrastra archivos aquí o{" "}
          <span className="text-amber-300 underline">selecciona</span>
        </p>
        <p className="text-xs text-white/30">
          Imágenes (JPEG, PNG, WebP, HEIC, GIF) · Vídeos (MP4, WebM, MOV)
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif,video/mp4,video/webm,video/quicktime,.heic,.heif,.mov"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled || atMax}
      />

      {/* Counter + add button */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-white/40">
          {entries.length}/{MAX_FILES} archivos
        </span>
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled || atMax}
          className="text-xs text-amber-300 hover:text-amber-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          + Añadir archivo
        </button>
      </div>

      {/* File grid */}
      {entries.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {entries.map((entry) => (
            <FileCard
              key={entry.clientId}
              entry={entry}
              onRemove={() => onRemove(entry.clientId)}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// FileCard sub-component
// ---------------------------------------------------------------------------

function FileCard({
  entry,
  onRemove,
  disabled,
}: {
  entry: MediaEntry;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <div className="relative flex flex-col gap-1.5 bg-white/5 rounded-xl p-2 border border-white/10">
      {/* Preview thumbnail */}
      <div className="relative w-full aspect-video bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center">
        {entry.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.previewUrl}
            alt={entry.originalName}
            className="w-full h-full object-cover"
          />
        ) : entry.mediaType === "VIDEO" ? (
          <Film size={32} className="text-white/30" />
        ) : (
          <ImageIcon size={32} className="text-white/30" />
        )}

        {/* Status overlays */}
        {entry.status === "processing" && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2">
            <Loader2 size={20} className="text-amber-300 animate-spin" />
            <span className="text-xs text-amber-300">Procesando…</span>
          </div>
        )}
        {entry.status === "error" && (
          <div className="absolute inset-0 bg-red-950/60 flex items-center justify-center">
            <AlertCircle size={24} className="text-red-400" />
          </div>
        )}
        {entry.status === "ready" && (
          <div className="absolute top-1 right-1">
            <CheckCircle2 size={16} className="text-emerald-400 drop-shadow" />
          </div>
        )}
      </div>

      {/* File info */}
      <p className="text-xs text-white/70 truncate leading-tight" title={entry.originalName}>
        {entry.originalName}
      </p>
      {entry.processedSize > 0 && (
        <p className="text-xs text-white/40">{formatSize(entry.processedSize)}</p>
      )}
      {entry.status === "error" && entry.errorMsg && (
        <p className="text-xs text-red-400 leading-tight">{entry.errorMsg}</p>
      )}

      {/* Remove button */}
      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Eliminar ${entry.originalName}`}
          className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/60 hover:text-red-400 hover:bg-black/80 transition-colors cursor-pointer"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

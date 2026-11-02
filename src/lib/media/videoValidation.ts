// Validación de un vídeo antes de subirlo a Bunny. Pura: la usan el
// formulario (para avisar junto al fichero) y createVideoUploadAction
// (que revalida lo que manda el cliente). Mismo patrón que validatePinPayload:
// acumula todos los errores en un mismo intento.

import { MAX_VIDEO_BYTES, MAX_VIDEO_DURATION_S } from "@/lib/bunny/constants";

export function validateVideoFile(f: {
  type: string;
  size: number;
  durationS: number | null;
}): string[] {
  const errors: string[] = [];
  if (!f.type.startsWith("video/")) {
    errors.push("El archivo no es un vídeo.");
  }
  if (f.size > MAX_VIDEO_BYTES) {
    errors.push(`El vídeo supera el tamaño máximo (${MAX_VIDEO_BYTES / (1024 * 1024)} MB).`);
  }
  // null = el navegador no sabe leer la duración (p. ej. HEVC en Chrome de
  // escritorio). No es un error: lo decide el servidor al procesarlo.
  if (f.durationS !== null && f.durationS > MAX_VIDEO_DURATION_S) {
    errors.push(`El vídeo dura más de ${MAX_VIDEO_DURATION_S} s.`);
  }
  return errors;
}

const VIDEO_MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

/**
 * MIME del vídeo. Algunos navegadores dejan `file.type` vacío para .mov;
 * en ese caso se deduce de la extensión, igual que hace MediaSection al
 * clasificar el archivo.
 */
export function videoMimeType(f: { type: string; name: string }): string {
  if (f.type.startsWith("video/")) return f.type;
  const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_MIME_BY_EXT[ext] ?? f.type;
}

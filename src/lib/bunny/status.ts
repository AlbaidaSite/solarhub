// Traducción del objeto Video de la API de Bunny a nuestro video_status.
// Puro: lo comparten webhook, server actions y scripts.

import type { VideoStatus } from "@/types/map";
import { DURATION_TOLERANCE_S, MAX_VIDEO_DURATION_S } from "./constants";

export type { VideoStatus };

// Subconjunto del objeto Video de la API que usamos.
export interface BunnyVideo {
  guid: string;
  /** 0 Created, 1 Uploaded, 2 Processing, 3 Transcoding, 4 Finished, 5 Error, 6 UploadFailed. */
  status: number;
  /** Duración en segundos (0 hasta que Bunny la conoce). */
  length: number;
  /** Resoluciones ya codificadas, separadas por comas ("360p,720p"). */
  availableResolutions: string | null;
  /** Fecha de subida (UTC; Bunny la envía sin zona horaria). */
  dateUploaded?: string;
}

// OJO: este enum es el del objeto Video, NO el `Status` del webhook.
export function mapBunnyVideo(
  v: BunnyVideo,
  maxDurationS: number = MAX_VIDEO_DURATION_S,
): { status: VideoStatus; durationS: number | null } | null {
  const durationS = v.length > 0 ? v.length : null;

  // Más largo de lo permitido: se marca como fallido aunque Bunny lo haya
  // codificado. El vídeo se conserva en Bunny y lo purga scripts/bunny/cleanup.ts.
  if (v.length > maxDurationS + DURATION_TOLERANCE_S) {
    return { status: "FAILED", durationS };
  }

  switch (v.status) {
    case 0:
      return { status: "UPLOADING", durationS };
    case 1:
    case 2:
      return { status: "PROCESSING", durationS };
    case 3: {
      // En Transcoding, la primera resolución terminada ya es reproducible.
      const hasResolution = (v.availableResolutions ?? "")
        .split(",")
        .some((r) => r.trim() !== "");
      return { status: hasResolution ? "READY" : "PROCESSING", durationS };
    }
    case 4:
      return { status: "READY", durationS };
    case 5:
    case 6:
      return { status: "FAILED", durationS };
    default:
      return null;
  }
}

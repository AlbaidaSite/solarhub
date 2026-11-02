// Qué ve cada usuario de un vídeo de Bunny. Cualquier usuario con sesión
// ve los vídeos listos y los que se están procesando; los que han fallado
// (o cuya subida se abandonó) solo los ve quien puede arreglarlos: el autor
// del pin o staff. No es una restricción de acceso, solo de presentación:
// RLS ya deja leer map_media a todo usuario autenticado.

import { STALE_UPLOAD_MS } from "@/lib/bunny/constants";
import type { VideoStatus } from "@/types/map";

export type VideoDisplay = "playable" | "processing" | "failed" | "hidden";

export function videoDisplayState(
  row: { video_status: VideoStatus; created_at: string },
  ctx: { canManage: boolean; now: number },
): VideoDisplay {
  const failed: VideoDisplay = ctx.canManage ? "failed" : "hidden";

  switch (row.video_status) {
    case "READY":
      return "playable";
    case "UPLOADING": {
      const age = ctx.now - new Date(row.created_at).getTime();
      return age > STALE_UPLOAD_MS ? failed : "processing";
    }
    case "PROCESSING":
      return "processing";
    case "FAILED":
      return failed;
  }
}

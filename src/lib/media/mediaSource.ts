import type { MediaSource, MediaType, VideoStatus } from "@/types/map";

export type { MediaSource };

/**
 * Clasifica una fila de map_media según dónde vive su fichero. Lanza en
 * combinaciones imposibles (el CHECK map_media_source_chk ya las impide).
 *
 * Mientras scripts/bunny/migrate-videos.ts migra un vídeo legado, la fila
 * tiene a la vez `path` y `bunny_video_id`: hasta que Bunny lo deja READY se
 * sigue sirviendo desde Storage, para no dejar de reproducirse a mitad.
 */
export function mediaSource(row: {
  type: MediaType;
  path: string | null;
  bunny_video_id: string | null;
  video_status?: VideoStatus | null;
}): MediaSource {
  if (row.type === "PHOTO" && row.path && !row.bunny_video_id) return "supabase-photo";
  if (row.type === "VIDEO" && row.bunny_video_id) {
    if (row.path && row.video_status !== undefined && row.video_status !== "READY") {
      return "supabase-video-legacy";
    }
    return "bunny-video";
  }
  if (row.type === "VIDEO" && row.path) return "supabase-video-legacy";
  throw new Error(
    `Fila de map_media imposible: type=${row.type}, path=${row.path ? "sí" : "no"}, bunny_video_id=${row.bunny_video_id ? "sí" : "no"}`,
  );
}

export interface Pin {
  id: number;
  user_id: string;
  sticker_id: number;
  country_code: string;
  state: string | null;
  place: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export interface Sticker {
  id: number;
  name: string;
  icon_path: string;
}

export type MediaType = "PHOTO" | "VIDEO";

// Estado de procesamiento de un vídeo alojado en Bunny Stream (enum
// public.video_status). Solo lo escribe el servidor (service_role).
export type VideoStatus = "UPLOADING" | "PROCESSING" | "READY" | "FAILED";

// Dónde vive el fichero de una fila de map_media (ver lib/media/mediaSource.ts).
export type MediaSource = "supabase-photo" | "supabase-video-legacy" | "bunny-video";

// Fila cruda de map_media tal y como la devuelve la BD.
export interface MapMediaRow {
  id: number;
  pin_id: number;
  type: MediaType;
  path: string | null;
  bunny_video_id: string | null;
  video_status: VideoStatus | null;
  created_at: string;
}

interface StorageMedia {
  id: number;
  pin_id: number;
  /** URL pública en Supabase Storage. */
  url: string;
}

export interface SupabasePhotoMedia extends StorageMedia {
  source: "supabase-photo";
  type: "PHOTO";
}

export interface SupabaseVideoMedia extends StorageMedia {
  source: "supabase-video-legacy";
  type: "VIDEO";
}

export interface BunnyVideoMedia {
  id: number;
  pin_id: number;
  source: "bunny-video";
  type: "VIDEO";
  videoId: string;
  videoStatus: VideoStatus;
  createdAt: string;
  /** Miniatura en el CDN de Bunny; null si falta NEXT_PUBLIC_BUNNY_CDN_HOSTNAME. */
  thumbnailUrl: string | null;
}

export type MapMedia = SupabasePhotoMedia | SupabaseVideoMedia | BunnyVideoMedia;

export interface PinDetail {
  pin: Pin;
  countryName: string;
  username: string;
  sticker: Sticker | null;
  media: MapMedia[];
}

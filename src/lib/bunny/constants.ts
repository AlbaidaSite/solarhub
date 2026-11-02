// Constantes de Bunny Stream. Módulo puro: lo importan servidor, cliente,
// scripts y tests, así que no puede leer variables de entorno ni secretos.

export const BUNNY_API_BASE = "https://video.bunnycdn.com";
export const BUNNY_TUS_ENDPOINT = "https://video.bunnycdn.com/tusupload";
// Si el iframe da 404, cambiar solo esto a https://iframe.mediadelivery.net/embed.
export const BUNNY_EMBED_BASE = "https://player.mediadelivery.net/embed";

// La doc de Bunny pide ≥ 1 h; la firma se valida en cada PATCH de TUS.
export const TUS_SIGNATURE_TTL_S = 6 * 3600;
export const EMBED_TOKEN_TTL_S = 3600;

// Los vídeos habituales duran ~40 s.
export const MAX_VIDEO_DURATION_S = 60;
export const DURATION_TOLERANCE_S = 2;
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

// Una fila UPLOADING más antigua que esto se da por abandonada.
export const STALE_UPLOAD_MS = 24 * 3600 * 1000;

export const PROCESSING_POLL_INTERVAL_MS = 10_000;
export const PROCESSING_POLL_MAX_MS = 5 * 60_000;

export const BUNNY_HTTP_TIMEOUT_MS = 10_000;

export const TUS_RETRY_DELAYS_MS = [0, 3000, 5000, 10000, 20000, 60000];

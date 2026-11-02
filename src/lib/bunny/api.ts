// Cliente HTTP mínimo de la API de Bunny Stream. Sin server-only y sin
// leer env: la configuración llega inyectada, así que lo usan igual las
// server actions, el webhook, los scripts y los tests (con fetch mockeado).

import { BUNNY_API_BASE, BUNNY_HTTP_TIMEOUT_MS } from "./constants";
import type { BunnyVideo } from "./status";

export interface BunnyApiConfig {
  libraryId: string;
  apiKey: string;
}

export class BunnyApiError extends Error {
  /** Código HTTP; 0 si la petición no llegó a responder (red o timeout). */
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "BunnyApiError";
    this.status = status;
  }
}

function videosUrl(cfg: BunnyApiConfig, suffix = ""): string {
  return `${BUNNY_API_BASE}/library/${encodeURIComponent(cfg.libraryId)}/videos${suffix}`;
}

async function request(
  cfg: BunnyApiConfig,
  url: string,
  init: RequestInit & { timeout?: boolean },
): Promise<Response> {
  const { timeout = true, headers, ...rest } = init;
  try {
    return await fetch(url, {
      ...rest,
      headers: { AccessKey: cfg.apiKey, accept: "application/json", ...headers },
      signal: timeout ? AbortSignal.timeout(BUNNY_HTTP_TIMEOUT_MS) : undefined,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new BunnyApiError(0, `Bunny no responde: ${reason}`);
  }
}

async function failure(res: Response, what: string): Promise<BunnyApiError> {
  let detail = "";
  try {
    detail = (await res.text()).slice(0, 200);
  } catch {
    // Sin cuerpo legible: basta con el código.
  }
  return new BunnyApiError(res.status, `${what}: HTTP ${res.status}${detail ? ` ${detail}` : ""}`);
}

function toBunnyVideo(raw: Record<string, unknown>): BunnyVideo {
  return {
    guid: String(raw.guid),
    status: Number(raw.status),
    length: Number(raw.length ?? 0),
    availableResolutions:
      typeof raw.availableResolutions === "string" ? raw.availableResolutions : null,
    dateUploaded: typeof raw.dateUploaded === "string" ? raw.dateUploaded : undefined,
  };
}

export async function createVideo(cfg: BunnyApiConfig, title: string): Promise<{ guid: string }> {
  const res = await request(cfg, videosUrl(cfg), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw await failure(res, "createVideo");
  const body = (await res.json()) as { guid?: unknown };
  if (typeof body.guid !== "string") {
    throw new BunnyApiError(res.status, "createVideo: respuesta sin guid");
  }
  return { guid: body.guid };
}

/** Devuelve null si el vídeo no existe (404). */
export async function getVideo(cfg: BunnyApiConfig, guid: string): Promise<BunnyVideo | null> {
  const res = await request(cfg, videosUrl(cfg, `/${encodeURIComponent(guid)}`), {
    method: "GET",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw await failure(res, "getVideo");
  return toBunnyVideo((await res.json()) as Record<string, unknown>);
}

/** Idempotente: un 404 cuenta como éxito. */
export async function deleteVideo(cfg: BunnyApiConfig, guid: string): Promise<void> {
  const res = await request(cfg, videosUrl(cfg, `/${encodeURIComponent(guid)}`), {
    method: "DELETE",
  });
  if (res.status === 404) return;
  if (!res.ok) throw await failure(res, "deleteVideo");
}

/** Sube el fichero entero en una petición. Solo lo usa el script de migración. */
export async function uploadVideoBinary(
  cfg: BunnyApiConfig,
  guid: string,
  body: BodyInit,
): Promise<void> {
  const res = await request(cfg, videosUrl(cfg, `/${encodeURIComponent(guid)}`), {
    method: "PUT",
    headers: { "content-type": "application/octet-stream" },
    body,
    timeout: false,
  });
  if (!res.ok) throw await failure(res, "uploadVideoBinary");
}

/** Una página del listado de la library. Solo lo usa el script de limpieza. */
export async function listVideos(
  cfg: BunnyApiConfig,
  page: number,
  itemsPerPage = 100,
): Promise<{ items: BunnyVideo[]; totalItems: number }> {
  const query = `?page=${page}&itemsPerPage=${itemsPerPage}&orderBy=date`;
  const res = await request(cfg, videosUrl(cfg, query), { method: "GET" });
  if (!res.ok) throw await failure(res, "listVideos");
  const body = (await res.json()) as { items?: Array<Record<string, unknown>>; totalItems?: number };
  return {
    items: (body.items ?? []).map(toBunnyVideo),
    totalItems: Number(body.totalItems ?? 0),
  };
}

// Firmas y URLs de Bunny Stream. Puro (solo node:crypto): no lee env ni
// importa server-only, para que Vitest y los scripts lo usen tal cual. No
// debe importarse desde componentes cliente (node:crypto no existe allí).

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { BUNNY_EMBED_BASE } from "./constants";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Firma de una subida TUS: sha256_hex(libraryId + apiKey + expires + videoId). */
export function signTusUpload(p: {
  libraryId: string;
  apiKey: string;
  expires: number;
  videoId: string;
}): string {
  return sha256Hex(`${p.libraryId}${p.apiKey}${p.expires}${p.videoId}`);
}

/** Token del embed: sha256_hex(tokenKey + videoId + expires), expires en segundos UNIX. */
export function signEmbedToken(p: { tokenKey: string; videoId: string; expires: number }): string {
  return sha256Hex(`${p.tokenKey}${p.videoId}${p.expires}`);
}

export function buildEmbedUrl(p: {
  libraryId: string;
  videoId: string;
  token: string;
  expires: number;
  params?: Record<string, string | boolean>;
}): string {
  const search = new URLSearchParams({ token: p.token, expires: String(p.expires) });
  for (const [key, value] of Object.entries(p.params ?? {})) {
    search.set(key, String(value));
  }
  return `${BUNNY_EMBED_BASE}/${p.libraryId}/${p.videoId}?${search.toString()}`;
}

export function buildThumbnailUrl(cdnHostname: string, videoId: string): string {
  return `https://${cdnHostname}/${videoId}/thumbnail.jpg`;
}

const HEX_SHA256 = /^[0-9a-f]{64}$/;

/**
 * Verifica la firma de un webhook de Bunny Stream: HMAC-SHA256 del cuerpo
 * EXACTO recibido con la Read-only API key. Nunca lanza: cualquier cosa
 * inesperada (cabecera ausente, mayúsculas, longitud) devuelve false.
 */
export function verifyWebhookSignature(p: {
  rawBody: string;
  signature: string | null;
  version: string | null;
  algorithm: string | null;
  secret: string;
}): boolean {
  if (p.version !== "v1" || p.algorithm !== "hmac-sha256") return false;
  if (!p.signature || !HEX_SHA256.test(p.signature) || !p.secret) return false;

  const expected = createHmac("sha256", p.secret).update(p.rawBody, "utf8").digest();
  const received = Buffer.from(p.signature, "hex");
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

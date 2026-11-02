// Webhook de Bunny Stream. Público (excluido del middleware de sesión en
// src/middleware.ts): su única defensa es la firma HMAC, que se comprueba
// antes de tocar la BD o la API de Bunny.
//
// No se confía en el payload: para cualquier evento se consulta a Bunny el
// estado real del vídeo (reconcileVideo). Un borrado (Status 32) también
// pasa por ahí: si Bunny responde 404 se borra la fila. Así una petición
// falsificada, en el peor caso, solo provoca una consulta a Bunny.

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getBunnyConfig } from "@/lib/bunny/config";
import { createReconcileDeps, reconcileVideo } from "@/lib/bunny/reconcile";
import { verifyWebhookSignature } from "@/lib/bunny/signing";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reply(status: number, body: Record<string, unknown> = {}): Response {
  return Response.json(body, { status });
}

interface BunnyWebhookPayload {
  VideoLibraryId?: unknown;
  VideoGuid?: unknown;
  Status?: unknown;
  IsLiveStreamWebhook?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  let cfg;
  try {
    cfg = getBunnyConfig();
  } catch (err) {
    console.error("[bunny-webhook] Bunny sin configurar:", err);
    return reply(500, { error: "not_configured" });
  }

  // El cuerpo EXACTO: parsearlo y re-serializarlo cambiaría la firma.
  const rawBody = await request.text();
  const valid = verifyWebhookSignature({
    rawBody,
    signature: request.headers.get("X-BunnyStream-Signature"),
    version: request.headers.get("X-BunnyStream-Signature-Version"),
    algorithm: request.headers.get("X-BunnyStream-Signature-Algorithm"),
    secret: cfg.readonlyApiKey,
  });
  if (!valid) return reply(401, { error: "invalid_signature" });

  let payload: BunnyWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as BunnyWebhookPayload;
  } catch {
    return reply(400, { error: "invalid_json" });
  }
  if (typeof payload !== "object" || payload === null) {
    return reply(400, { error: "invalid_payload" });
  }

  // Eventos que no son nuestros: 200 para que Bunny no reintente.
  if (payload.IsLiveStreamWebhook === true) return reply(200, { result: "ignored" });
  if (String(payload.VideoLibraryId) !== cfg.libraryId) return reply(200, { result: "ignored" });
  if (typeof payload.VideoGuid !== "string" || !UUID.test(payload.VideoGuid)) {
    return reply(200, { result: "ignored" });
  }

  const guid = payload.VideoGuid.toLowerCase();
  try {
    const result = await reconcileVideo(
      createReconcileDeps(createSupabaseAdminClient(), cfg),
      guid,
    );
    console.info(`[bunny-webhook] ${guid} status=${String(payload.Status)} → ${result}`);
    // not_found: vídeos de filas ya borradas; nada que hacer.
    return reply(200, { result });
  } catch (err) {
    // Red, timeout o 5xx de Bunny (o fallo de BD): 500 para que Bunny reintente.
    console.error(`[bunny-webhook] ${guid} reconcile falló:`, err);
    return reply(500, { error: "reconcile_failed" });
  }
}

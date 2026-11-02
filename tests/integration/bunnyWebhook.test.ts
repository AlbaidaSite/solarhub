// SUT: src/app/api/webhooks/bunny/route.ts
// Verificación de firma sobre el cuerpo exacto, filtros de eventos ajenos
// y fetch-back: el payload nunca decide el estado, lo decide Bunny.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { createSupabaseStub, type StubResult } from "../fixtures/supabaseMock";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
}));

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { POST } from "@/app/api/webhooks/bunny/route";

const GUID = "32d140e2-e4f4-4eec-9d53-20371e9be607";
const SECRET = "test-readonly-key";
const BUNNY_ENV = {
  BUNNY_STREAM_LIBRARY_ID: "12345",
  BUNNY_STREAM_API_KEY: "test-api-key",
  BUNNY_STREAM_READONLY_API_KEY: SECRET,
  BUNNY_STREAM_TOKEN_KEY: "test-token-key",
  NEXT_PUBLIC_BUNNY_CDN_HOSTNAME: "vz-test.b-cdn.net",
};

let fetchMock: ReturnType<typeof vi.fn>;

function bunnyReturns(response: () => Response) {
  fetchMock = vi.fn(async () => response());
  vi.stubGlobal("fetch", fetchMock);
}

function webhook(payload: Record<string, unknown>, { secret = SECRET, rawBody }: { secret?: string; rawBody?: string } = {}) {
  const body = rawBody ?? JSON.stringify(payload);
  return new Request("https://solarhub.es/api/webhooks/bunny", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "X-BunnyStream-Signature-Version": "v1",
      "X-BunnyStream-Signature-Algorithm": "hmac-sha256",
      "X-BunnyStream-Signature": createHmac("sha256", secret).update(body).digest("hex"),
    },
  });
}

// Admin stub: la primera consulta a map_media es el lookup por guid.
function mockAdmin(lookup: StubResult) {
  const stub = createSupabaseStub({
    from: { map_media: { default: { data: null, error: null }, queue: [lookup] } },
  });
  vi.mocked(createSupabaseAdminClient).mockReturnValue(stub.client as never);
  return stub;
}

function chainCall(stub: ReturnType<typeof createSupabaseStub>, method: string) {
  const call = stub.calls.from.find((c) => c.table === "map_media" && c.chain.includes(method));
  return call ? call.args[call.chain.indexOf(method)] : undefined;
}

const event = { VideoLibraryId: 12345, VideoGuid: GUID, Status: 3 };

beforeEach(() => {
  vi.clearAllMocks();
  for (const [key, value] of Object.entries(BUNNY_ENV)) vi.stubEnv(key, value);
  bunnyReturns(() => new Response("{}", { status: 500 }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("webhook de Bunny", () => {
  it("firma inválida: 401 y cero llamadas a BD o a Bunny", async () => {
    const res = await POST(webhook(event, { secret: "otra" }));
    expect(res.status).toBe(401);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("body re-serializado tras firmar: 401", async () => {
    const req = webhook(event);
    const tampered = new Request(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(event, null, 2),
    });
    expect((await POST(tampered)).status).toBe(401);
  });

  it("fetch-back READY: actualiza estado y duración", async () => {
    const admin = mockAdmin({ data: { id: 9 }, error: null });
    bunnyReturns(
      () => new Response(JSON.stringify({ guid: GUID, status: 4, length: 37, availableResolutions: "360p,720p" })),
    );

    const res = await POST(webhook(event));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: "updated" });
    expect(chainCall(admin, "update")?.[0]).toEqual({ video_status: "READY", duration_s: 37 });
  });

  it("no se fía del payload: un Status 'terminado' con Bunny procesando deja PROCESSING", async () => {
    const admin = mockAdmin({ data: { id: 9 }, error: null });
    bunnyReturns(() => new Response(JSON.stringify({ guid: GUID, status: 2, length: 0, availableResolutions: null })));
    await POST(webhook({ ...event, Status: 3 }));
    expect(chainCall(admin, "update")?.[0]).toEqual({ video_status: "PROCESSING", duration_s: null });
  });

  it("fetch-back 500: el route devuelve 500 para que Bunny reintente", async () => {
    mockAdmin({ data: { id: 9 }, error: null });
    bunnyReturns(() => new Response("boom", { status: 500 }));
    expect((await POST(webhook(event))).status).toBe(500);
  });

  it("fetch-back 404: borra la fila", async () => {
    const admin = mockAdmin({ data: { id: 9 }, error: null });
    bunnyReturns(() => new Response("", { status: 404 }));
    const res = await POST(webhook(event));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: "deleted" });
    expect(chainCall(admin, "delete")).toBeDefined();
  });

  it("Status 32 (VideoDeleted): confirma con Bunny y, si da 404, borra la fila", async () => {
    const admin = mockAdmin({ data: { id: 9 }, error: null });
    bunnyReturns(() => new Response("", { status: 404 }));
    const res = await POST(webhook({ ...event, Status: 32 }));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(chainCall(admin, "delete")).toBeDefined();
  });

  it("Status 32 falsificado de un vídeo que sigue en Bunny: no borra nada", async () => {
    const admin = mockAdmin({ data: { id: 9 }, error: null });
    bunnyReturns(
      () => new Response(JSON.stringify({ guid: GUID, status: 4, length: 30, availableResolutions: "720p" })),
    );
    await POST(webhook({ ...event, Status: 32 }));
    expect(chainCall(admin, "delete")).toBeUndefined();
  });

  it("GUID desconocido: 200 sin efectos ni consulta a Bunny", async () => {
    const admin = mockAdmin({ data: null, error: null });
    const res = await POST(webhook(event));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: "not_found" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(chainCall(admin, "update")).toBeUndefined();
  });

  it.each([
    ["otra library", { ...event, VideoLibraryId: 999 }],
    ["evento de live stream", { ...event, IsLiveStreamWebhook: true }],
    ["GUID que no es un UUID", { ...event, VideoGuid: "../../etc" }],
  ])("%s: 200 sin efectos", async (_label, payload) => {
    const res = await POST(webhook(payload));
    expect(res.status).toBe(200);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sin variables de Bunny: 500 controlado, no excepción", async () => {
    for (const key of Object.keys(BUNNY_ENV)) vi.stubEnv(key, "");
    const res = await POST(webhook(event));
    expect(res.status).toBe(500);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });
});

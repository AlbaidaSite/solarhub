// SUT: src/app/(app)/mapa/video-actions.ts
// createVideoUploadAction, abortVideoUploadAction, syncVideoStatusAction y
// getVideoEmbedUrlAction, con el cliente de Supabase stubbeado y la API de
// Bunny detrás de un fetch mockeado.
//
// Contrato común con el resto de actions: sin sesión no se construye el
// cliente admin ni se llama a Bunny.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSupabaseStub, type StubResult } from "../fixtures/supabaseMock";

vi.mock("@/lib/supabase/actionAuth", () => ({
  requireUserActionClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
}));

import { requireUserActionClient } from "@/lib/supabase/actionAuth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { signEmbedToken, signTusUpload } from "@/lib/bunny/signing";
import {
  abortVideoUploadAction,
  createVideoUploadAction,
  getVideoEmbedUrlAction,
  syncVideoStatusAction,
} from "@/app/(app)/mapa/video-actions";

const GUID = "32d140e2-e4f4-4eec-9d53-20371e9be607";
const BUNNY_ENV = {
  BUNNY_STREAM_LIBRARY_ID: "12345",
  BUNNY_STREAM_API_KEY: "test-api-key",
  BUNNY_STREAM_READONLY_API_KEY: "test-readonly-key",
  BUNNY_STREAM_TOKEN_KEY: "test-token-key",
  NEXT_PUBLIC_BUNNY_CDN_HOSTNAME: "vz-test.b-cdn.net",
};

const validUpload = {
  pinId: 9,
  sizeBytes: 30 * 1024 * 1024,
  durationS: 40,
  mimeType: "video/mp4",
};

type FetchCall = { url: string; method: string; headers: Record<string, string>; body?: string };
let fetchCalls: FetchCall[];

function mockBunny(handler: (call: FetchCall) => Response | Promise<Response>) {
  fetchCalls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const call: FetchCall = {
        url,
        method: init?.method ?? "GET",
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: typeof init?.body === "string" ? init.body : undefined,
      };
      fetchCalls.push(call);
      return handler(call);
    }),
  );
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

// Stub del cliente del usuario: `from` de cada tabla con su resultado.
function mockUser(
  userId: string | null,
  tables: Record<string, StubResult | { default: StubResult; queue?: StubResult[] }> = {},
  isStaff = false,
) {
  if (userId === null) {
    vi.mocked(requireUserActionClient).mockResolvedValue({ ok: false, error: "No autenticado." });
    return null;
  }
  const stub = createSupabaseStub({
    authUserId: userId,
    from: tables,
    rpc: { is_staff: { data: isStaff, error: null } },
  });
  vi.mocked(requireUserActionClient).mockResolvedValue({
    ok: true,
    supabase: stub.client as never,
    userId,
  });
  return stub;
}

function mapMediaCalls(stub: ReturnType<typeof createSupabaseStub>) {
  return stub.calls.from.filter((c) => c.table === "map_media");
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const [key, value] of Object.entries(BUNNY_ENV)) vi.stubEnv(key, value);
  mockBunny(() => json({}, 500));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("createVideoUploadAction", () => {
  it("sin sesión: ni Bunny ni cliente admin", async () => {
    mockUser(null);
    const result = await createVideoUploadAction(validUpload);
    expect(result.ok).toBe(false);
    expect(fetchCalls).toHaveLength(0);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("sin permiso sobre el pin: ni Bunny ni insert", async () => {
    const stub = mockUser("u-OTHER", { pin: { data: { user_id: "u-OWNER" }, error: null } });
    const result = await createVideoUploadAction(validUpload);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("sin permiso");
    expect(fetchCalls).toHaveLength(0);
    expect(mapMediaCalls(stub!)).toHaveLength(0);
  });

  it("revalida el fichero en el servidor: acumula errores y no llama a Bunny", async () => {
    mockUser("u-A", { pin: { data: { user_id: "u-A" }, error: null } });
    const result = await createVideoUploadAction({
      ...validUpload,
      mimeType: "image/png",
      sizeBytes: 600 * 1024 * 1024,
      durationS: 90,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.split("\n")).toHaveLength(3);
    expect(fetchCalls).toHaveLength(0);
  });

  it("camino feliz: crea en Bunny, inserta UPLOADING y devuelve la firma TUS", async () => {
    const stub = mockUser("u-A", {
      pin: { data: { user_id: "u-A" }, error: null },
      map_media: { data: { id: 55 }, error: null },
    });
    mockBunny(() => json({ guid: GUID }));

    const result = await createVideoUploadAction(validUpload);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // POST a Bunny con la API key de la library.
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].method).toBe("POST");
    expect(fetchCalls[0].url).toBe("https://video.bunnycdn.com/library/12345/videos");
    expect(fetchCalls[0].headers.AccessKey).toBe("test-api-key");

    // Insert con el cliente del usuario (RLS + trigger), no con el admin.
    const insert = mapMediaCalls(stub!).find((c) => c.chain.includes("insert"))!;
    expect(insert.args[insert.chain.indexOf("insert")][0]).toEqual({
      pin_id: 9,
      type: "VIDEO",
      path: null,
      bunny_video_id: GUID,
      video_status: "UPLOADING",
    });
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();

    expect(result).toMatchObject({ mediaId: 55, videoId: GUID, libraryId: "12345" });
    expect(result.expires).toBeGreaterThan(Date.now() / 1000 + 3600);
    expect(result.signature).toBe(
      signTusUpload({ libraryId: "12345", apiKey: "test-api-key", expires: result.expires, videoId: GUID }),
    );
  });

  it("staff puede subir a un pin ajeno", async () => {
    mockUser(
      "u-MOD",
      {
        pin: { data: { user_id: "u-A" }, error: null },
        map_media: { data: { id: 56 }, error: null },
      },
      true,
    );
    mockBunny(() => json({ guid: GUID }));
    const result = await createVideoUploadAction(validUpload);
    expect(result.ok).toBe(true);
  });

  it("insert fallido: compensa borrando el vídeo en Bunny", async () => {
    mockUser("u-A", {
      pin: { data: { user_id: "u-A" }, error: null },
      map_media: { data: null, error: { message: "violates row-level security" } },
    });
    mockBunny((call) => (call.method === "POST" ? json({ guid: GUID }) : new Response(null, { status: 200 })));

    const result = await createVideoUploadAction(validUpload);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).not.toContain("row-level");
    expect(fetchCalls.map((c) => c.method)).toEqual(["POST", "DELETE"]);
    expect(fetchCalls[1].url).toContain(GUID);
  });

  it("fallo de Bunny al crear: no hay insert", async () => {
    const stub = mockUser("u-A", { pin: { data: { user_id: "u-A" }, error: null } });
    mockBunny(() => json({ message: "boom" }, 500));
    const result = await createVideoUploadAction(validUpload);
    expect(result.ok).toBe(false);
    expect(mapMediaCalls(stub!)).toHaveLength(0);
  });

  it("sin variables de Bunny: error controlado, sin insert", async () => {
    vi.unstubAllEnvs();
    for (const key of Object.keys(BUNNY_ENV)) vi.stubEnv(key, "");
    const stub = mockUser("u-A", { pin: { data: { user_id: "u-A" }, error: null } });
    const result = await createVideoUploadAction(validUpload);
    expect(result.ok).toBe(false);
    expect(fetchCalls).toHaveLength(0);
    expect(mapMediaCalls(stub!)).toHaveLength(0);
  });
});

describe("abortVideoUploadAction", () => {
  const uploadingRow = {
    id: 55,
    pin_id: 9,
    bunny_video_id: GUID,
    video_status: "UPLOADING",
    created_at: "2026-11-02T10:00:00Z",
  };

  it("sin sesión: nada", async () => {
    mockUser(null);
    expect((await abortVideoUploadAction(55)).ok).toBe(false);
    expect(fetchCalls).toHaveLength(0);
  });

  it("fila UPLOADING gestionable: borra la fila y después el vídeo en Bunny", async () => {
    const stub = mockUser("u-A", {
      pin: { data: { user_id: "u-A" }, error: null },
      map_media: { default: { data: null, error: null }, queue: [{ data: uploadingRow, error: null }] },
    });
    mockBunny(() => new Response(null, { status: 200 }));

    expect(await abortVideoUploadAction(55)).toEqual({ ok: true });
    expect(mapMediaCalls(stub!).some((c) => c.chain.includes("delete"))).toBe(true);
    expect(fetchCalls).toEqual([expect.objectContaining({ method: "DELETE" })]);
  });

  it("un fallo de Bunny al borrar no hace fallar la cancelación", async () => {
    mockUser("u-A", {
      pin: { data: { user_id: "u-A" }, error: null },
      map_media: { default: { data: null, error: null }, queue: [{ data: uploadingRow, error: null }] },
    });
    mockBunny(() => json({}, 503));
    expect(await abortVideoUploadAction(55)).toEqual({ ok: true });
  });

  it("una fila que ya no está UPLOADING no se toca", async () => {
    const stub = mockUser("u-A", {
      pin: { data: { user_id: "u-A" }, error: null },
      map_media: { data: { ...uploadingRow, video_status: "READY" }, error: null },
    });
    expect((await abortVideoUploadAction(55)).ok).toBe(false);
    expect(mapMediaCalls(stub!).some((c) => c.chain.includes("delete"))).toBe(false);
    expect(fetchCalls).toHaveLength(0);
  });

  it("sin permiso sobre el pin: no se toca", async () => {
    const stub = mockUser("u-OTHER", {
      pin: { data: { user_id: "u-A" }, error: null },
      map_media: { data: uploadingRow, error: null },
    });
    expect((await abortVideoUploadAction(55)).ok).toBe(false);
    expect(mapMediaCalls(stub!).some((c) => c.chain.includes("delete"))).toBe(false);
    expect(fetchCalls).toHaveLength(0);
  });
});

describe("syncVideoStatusAction", () => {
  it("PROCESSING: consulta a Bunny, actualiza con el cliente admin y devuelve playable", async () => {
    mockUser("u-OTHER", {
      pin: { data: { user_id: "u-A" }, error: null },
      map_media: {
        data: { id: 55, pin_id: 9, bunny_video_id: GUID, video_status: "PROCESSING", created_at: "2026-11-02T10:00:00Z" },
        error: null,
      },
    });
    const admin = createSupabaseStub({
      from: {
        map_media: { default: { data: null, error: null }, queue: [{ data: { id: 55 }, error: null }] },
      },
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(admin.client as never);
    mockBunny(() => json({ guid: GUID, status: 4, length: 38, availableResolutions: "360p,720p" }));

    expect(await syncVideoStatusAction(55)).toEqual({ ok: true, display: "playable" });
    const update = admin.calls.from.find((c) => c.chain.includes("update"))!;
    expect(update.args[update.chain.indexOf("update")][0]).toEqual({
      video_status: "READY",
      duration_s: 38,
    });
  });

  it("READY: no consulta a Bunny", async () => {
    mockUser("u-A", {
      pin: { data: { user_id: "u-A" }, error: null },
      map_media: {
        data: { id: 55, pin_id: 9, bunny_video_id: GUID, video_status: "READY", created_at: "2026-11-02T10:00:00Z" },
        error: null,
      },
    });
    expect(await syncVideoStatusAction(55)).toEqual({ ok: true, display: "playable" });
    expect(fetchCalls).toHaveLength(0);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("fila no visible: error", async () => {
    mockUser("u-A", { map_media: { data: null, error: null } });
    expect((await syncVideoStatusAction(55)).ok).toBe(false);
    expect(fetchCalls).toHaveLength(0);
  });
});

describe("getVideoEmbedUrlAction", () => {
  const readyRow = {
    id: 55,
    pin_id: 9,
    bunny_video_id: GUID,
    video_status: "READY",
    created_at: "2026-11-02T10:00:00Z",
  };

  it("sin sesión: sin URL", async () => {
    mockUser(null);
    expect((await getVideoEmbedUrlAction(55)).ok).toBe(false);
  });

  it("fila no visible: error y sin URL", async () => {
    mockUser("u-A", { map_media: { data: null, error: null } });
    const result = await getVideoEmbedUrlAction(55);
    expect(result).toEqual({ ok: false, error: "Vídeo no encontrado." });
  });

  it("vídeo que no está READY: error", async () => {
    mockUser("u-A", { map_media: { data: { ...readyRow, video_status: "PROCESSING" }, error: null } });
    const result = await getVideoEmbedUrlAction(55);
    expect(result.ok).toBe(false);
  });

  it("READY: URL del reproductor con token y expires firmados", async () => {
    mockUser("u-ANY", { map_media: { data: readyRow, error: null } });
    const result = await getVideoEmbedUrlAction(55);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const url = new URL(result.url);
    expect(`${url.origin}${url.pathname}`).toBe(`https://player.mediadelivery.net/embed/12345/${GUID}`);
    const expires = Number(url.searchParams.get("expires"));
    expect(expires).toBeGreaterThan(Date.now() / 1000);
    expect(url.searchParams.get("token")).toBe(
      signEmbedToken({ tokenKey: "test-token-key", videoId: GUID, expires }),
    );
    expect(url.searchParams.get("autoplay")).toBe("true");
    expect(url.searchParams.get("playsinline")).toBe("true");
    // No hace falta Bunny para firmar.
    expect(fetchCalls).toHaveLength(0);
  });
});

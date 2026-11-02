// SUT: src/lib/bunny/api.ts
// Forma de las peticiones a la API de Bunny y el tratamiento de 404
// (getVideo → null, deleteVideo → éxito idempotente).

import { describe, it, expect, vi, afterEach } from "vitest";
import { BunnyApiError, createVideo, deleteVideo, getVideo, listVideos } from "@/lib/bunny/api";

const cfg = { libraryId: "12345", apiKey: "secret-key" };
const GUID = "32d140e2-e4f4-4eec-9d53-20371e9be607";

function mockFetch(response: Response | Error) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api de Bunny", () => {
  it("createVideo: POST con AccessKey y título; devuelve el guid", async () => {
    const fetchMock = mockFetch(new Response(JSON.stringify({ guid: GUID }), { status: 200 }));
    await expect(createVideo(cfg, "pin-1-1")).resolves.toEqual({ guid: GUID });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://video.bunnycdn.com/library/12345/videos");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).AccessKey).toBe("secret-key");
    expect(JSON.parse(String(init?.body))).toEqual({ title: "pin-1-1" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("getVideo: 404 → null", async () => {
    mockFetch(new Response("not found", { status: 404 }));
    await expect(getVideo(cfg, GUID)).resolves.toBeNull();
  });

  it("getVideo: 500 → BunnyApiError con el código", async () => {
    mockFetch(new Response("boom", { status: 500 }));
    await expect(getVideo(cfg, GUID)).rejects.toMatchObject({ name: "BunnyApiError", status: 500 });
  });

  it("getVideo: fallo de red → BunnyApiError con status 0", async () => {
    mockFetch(new TypeError("fetch failed"));
    const err = await getVideo(cfg, GUID).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BunnyApiError);
    expect((err as BunnyApiError).status).toBe(0);
  });

  it("deleteVideo: 404 cuenta como éxito", async () => {
    const fetchMock = mockFetch(new Response(null, { status: 404 }));
    await expect(deleteVideo(cfg, GUID)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1]?.method).toBe("DELETE");
  });

  it("listVideos: pagina y normaliza los items", async () => {
    const fetchMock = mockFetch(
      new Response(
        JSON.stringify({
          totalItems: 1,
          items: [{ guid: GUID, status: 4, length: 30, availableResolutions: "720p", dateUploaded: "2026-11-01T10:00:00" }],
        }),
        { status: 200 },
      ),
    );
    const page = await listVideos(cfg, 2, 50);
    expect(fetchMock.mock.calls[0][0]).toContain("page=2&itemsPerPage=50");
    expect(page).toEqual({
      totalItems: 1,
      items: [{ guid: GUID, status: 4, length: 30, availableResolutions: "720p", dateUploaded: "2026-11-01T10:00:00" }],
    });
  });
});

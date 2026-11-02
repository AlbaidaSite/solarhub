// SUT: src/lib/bunny/status.ts → mapBunnyVideo
// Enum `status` del objeto Video de la API (no el del webhook):
// 0 Created, 1 Uploaded, 2 Processing, 3 Transcoding, 4 Finished,
// 5 Error, 6 UploadFailed.

import { describe, it, expect } from "vitest";
import { mapBunnyVideo, type BunnyVideo } from "@/lib/bunny/status";

function video(overrides: Partial<BunnyVideo> = {}): BunnyVideo {
  return { guid: "g", status: 4, length: 40, availableResolutions: "360p,720p", ...overrides };
}

describe("mapBunnyVideo", () => {
  it.each([
    [0, "UPLOADING"],
    [1, "PROCESSING"],
    [2, "PROCESSING"],
    [4, "READY"],
    [5, "FAILED"],
    [6, "FAILED"],
  ] as const)("status %i → %s", (status, expected) => {
    expect(mapBunnyVideo(video({ status }))?.status).toBe(expected);
  });

  it("status 3 con alguna resolución ya codificada → READY", () => {
    expect(mapBunnyVideo(video({ status: 3, availableResolutions: "360p" }))?.status).toBe("READY");
  });

  it("status 3 sin resoluciones → PROCESSING", () => {
    expect(mapBunnyVideo(video({ status: 3, availableResolutions: null }))?.status).toBe("PROCESSING");
    expect(mapBunnyVideo(video({ status: 3, availableResolutions: "" }))?.status).toBe("PROCESSING");
  });

  it("estado desconocido → null (no se toca la fila)", () => {
    expect(mapBunnyVideo(video({ status: 99 }))).toBeNull();
  });

  it("duración en el límite con tolerancia (62 s) no falla", () => {
    expect(mapBunnyVideo(video({ length: 62 }))).toEqual({ status: "READY", durationS: 62 });
  });

  it("63 s → FAILED aunque Bunny lo haya terminado", () => {
    expect(mapBunnyVideo(video({ length: 63 }))).toEqual({ status: "FAILED", durationS: 63 });
  });

  it("la duración se evalúa antes que el estado", () => {
    expect(mapBunnyVideo(video({ status: 99, length: 120 }))?.status).toBe("FAILED");
  });

  it("length 0 → durationS null", () => {
    expect(mapBunnyVideo(video({ status: 1, length: 0 }))).toEqual({
      status: "PROCESSING",
      durationS: null,
    });
  });

  it("acepta otro máximo de duración", () => {
    expect(mapBunnyVideo(video({ length: 100 }), 120)?.status).toBe("READY");
  });
});

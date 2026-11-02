// SUT: src/lib/media/videoDisplay.ts
// Cualquier usuario con sesión ve los vídeos listos y los que se procesan;
// los fallidos (o abandonados) solo quien puede arreglarlos.

import { describe, it, expect } from "vitest";
import { videoDisplayState } from "@/lib/media/videoDisplay";
import { STALE_UPLOAD_MS } from "@/lib/bunny/constants";
import type { VideoStatus } from "@/types/map";

const CREATED = "2026-11-01T12:00:00.000Z";
const T0 = new Date(CREATED).getTime();

function state(status: VideoStatus, canManage: boolean, now = T0 + 1000) {
  return videoDisplayState({ video_status: status, created_at: CREATED }, { canManage, now });
}

describe("videoDisplayState", () => {
  it.each([
    ["READY", true, "playable"],
    ["READY", false, "playable"],
    ["PROCESSING", true, "processing"],
    ["PROCESSING", false, "processing"],
    ["UPLOADING", true, "processing"],
    ["UPLOADING", false, "processing"],
    ["FAILED", true, "failed"],
    ["FAILED", false, "hidden"],
  ] as const)("%s · canManage=%s → %s", (status, canManage, expected) => {
    expect(state(status, canManage)).toBe(expected);
  });

  it("UPLOADING justo en el límite sigue procesándose", () => {
    expect(state("UPLOADING", true, T0 + STALE_UPLOAD_MS)).toBe("processing");
    expect(state("UPLOADING", false, T0 + STALE_UPLOAD_MS)).toBe("processing");
  });

  it("UPLOADING pasado el límite se da por fallido", () => {
    expect(state("UPLOADING", true, T0 + STALE_UPLOAD_MS + 1)).toBe("failed");
    expect(state("UPLOADING", false, T0 + STALE_UPLOAD_MS + 1)).toBe("hidden");
  });

  it("PROCESSING no caduca", () => {
    expect(state("PROCESSING", false, T0 + 10 * STALE_UPLOAD_MS)).toBe("processing");
  });
});

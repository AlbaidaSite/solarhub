// SUT: src/lib/media/mediaSource.ts

import { describe, it, expect } from "vitest";
import { mediaSource } from "@/lib/media/mediaSource";

const GUID = "32d140e2-e4f4-4eec-9d53-20371e9be607";

describe("mediaSource", () => {
  it("foto en Storage", () => {
    expect(mediaSource({ type: "PHOTO", path: "map-media/1/a.webp", bunny_video_id: null })).toBe(
      "supabase-photo",
    );
  });

  it("vídeo legado en Storage", () => {
    expect(mediaSource({ type: "VIDEO", path: "map-media/1/a.mp4", bunny_video_id: null })).toBe(
      "supabase-video-legacy",
    );
  });

  it("vídeo en Bunny", () => {
    expect(mediaSource({ type: "VIDEO", path: null, bunny_video_id: GUID })).toBe("bunny-video");
  });

  it("vídeo a medio migrar: Storage hasta que Bunny lo deja READY", () => {
    const row = { type: "VIDEO" as const, path: "map-media/1/a.mp4", bunny_video_id: GUID };
    expect(mediaSource({ ...row, video_status: "PROCESSING" })).toBe("supabase-video-legacy");
    expect(mediaSource({ ...row, video_status: "FAILED" })).toBe("supabase-video-legacy");
    expect(mediaSource({ ...row, video_status: "READY" })).toBe("bunny-video");
  });

  it.each([
    ["foto con vídeo de Bunny", { type: "PHOTO" as const, path: "a.webp", bunny_video_id: GUID }],
    ["foto sin path", { type: "PHOTO" as const, path: null, bunny_video_id: null }],
    ["vídeo sin path ni Bunny", { type: "VIDEO" as const, path: null, bunny_video_id: null }],
  ])("lanza en combinaciones imposibles: %s", (_label, row) => {
    expect(() => mediaSource(row)).toThrow(/imposible/);
  });
});

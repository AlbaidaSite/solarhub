// SUT: src/lib/media/videoValidation.ts
// Mismo patrón que validatePinPayload: todos los errores en un intento.

import { describe, it, expect } from "vitest";
import { validateVideoFile, videoMimeType } from "@/lib/media/videoValidation";

const MB = 1024 * 1024;

describe("validateVideoFile", () => {
  it("un vídeo válido no da errores", () => {
    expect(validateVideoFile({ type: "video/mp4", size: 40 * MB, durationS: 40 })).toEqual([]);
  });

  it("acumula los tres errores a la vez", () => {
    const errors = validateVideoFile({ type: "image/png", size: 501 * MB, durationS: 61 });
    expect(errors).toHaveLength(3);
    expect(errors[0]).toContain("no es un vídeo");
    expect(errors[1]).toContain("500 MB");
    expect(errors[2]).toContain("60 s");
  });

  it("durationS null no es un error (decide el servidor)", () => {
    expect(validateVideoFile({ type: "video/quicktime", size: MB, durationS: null })).toEqual([]);
  });

  it("los límites exactos se aceptan", () => {
    expect(validateVideoFile({ type: "video/mp4", size: 500 * MB, durationS: 60 })).toEqual([]);
  });
});

describe("videoMimeType", () => {
  it("respeta el MIME del navegador si es de vídeo", () => {
    expect(videoMimeType({ type: "video/webm", name: "a.mp4" })).toBe("video/webm");
  });

  it("deduce el MIME por extensión cuando el navegador lo deja vacío", () => {
    expect(videoMimeType({ type: "", name: "IMG_0001.MOV" })).toBe("video/quicktime");
    expect(videoMimeType({ type: "", name: "clip.mp4" })).toBe("video/mp4");
  });

  it("sin pista, devuelve lo que hubiera", () => {
    expect(videoMimeType({ type: "", name: "archivo" })).toBe("");
  });
});

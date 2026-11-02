// SUT: src/lib/bunny/reconcile.ts → reconcileVideo
// Los cuatro resultados y la propagación de errores de getVideo (que es lo
// que hace que el webhook responda 500 y Bunny reintente).

import { describe, it, expect, vi } from "vitest";
import { reconcileVideo, type ReconcileDeps } from "@/lib/bunny/reconcile";
import type { BunnyVideo } from "@/lib/bunny/status";

const GUID = "32d140e2-e4f4-4eec-9d53-20371e9be607";

function deps(overrides: Partial<ReconcileDeps> = {}): ReconcileDeps {
  return {
    getVideo: vi.fn(async (): Promise<BunnyVideo | null> => ({
      guid: GUID,
      status: 4,
      length: 41,
      availableResolutions: "360p,720p,1080p",
    })),
    findRowByGuid: vi.fn(async () => ({ id: 7 })),
    updateRow: vi.fn(async () => undefined),
    deleteRow: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("reconcileVideo", () => {
  it("sin fila → not_found, sin consultar a Bunny", async () => {
    const d = deps({ findRowByGuid: vi.fn(async () => null) });
    expect(await reconcileVideo(d, GUID)).toBe("not_found");
    expect(d.getVideo).not.toHaveBeenCalled();
  });

  it("Bunny ya no tiene el vídeo → borra la fila", async () => {
    const d = deps({ getVideo: vi.fn(async () => null) });
    expect(await reconcileVideo(d, GUID)).toBe("deleted");
    expect(d.deleteRow).toHaveBeenCalledWith(7);
    expect(d.updateRow).not.toHaveBeenCalled();
  });

  it("estado desconocido → unchanged, sin escribir", async () => {
    const d = deps({
      getVideo: vi.fn(async () => ({ guid: GUID, status: 99, length: 0, availableResolutions: null })),
    });
    expect(await reconcileVideo(d, GUID)).toBe("unchanged");
    expect(d.updateRow).not.toHaveBeenCalled();
    expect(d.deleteRow).not.toHaveBeenCalled();
  });

  it("estado conocido → updated con estado y duración", async () => {
    const d = deps();
    expect(await reconcileVideo(d, GUID)).toBe("updated");
    expect(d.updateRow).toHaveBeenCalledWith(7, { video_status: "READY", duration_s: 41 });
  });

  it("propaga los errores de getVideo sin tocar la fila", async () => {
    const d = deps({ getVideo: vi.fn(async () => Promise.reject(new Error("timeout"))) });
    await expect(reconcileVideo(d, GUID)).rejects.toThrow("timeout");
    expect(d.updateRow).not.toHaveBeenCalled();
    expect(d.deleteRow).not.toHaveBeenCalled();
  });
});

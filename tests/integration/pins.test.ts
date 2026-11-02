// SUT: src/app/(app)/mapa/actions.ts → createPinAction, updatePinAction,
// deletePinAction, deleteMapMediaAction, addMapMediaAction
// Cubre RF-024 (publicar pin), RF-025 (editar), RF-026 (eliminar), RN-018
// (autoría), el mínimo de multimedia obligatorio de un pin y el borrado de
// los vídeos alojados en Bunny Stream.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSupabaseStub } from "../fixtures/supabaseMock";

vi.mock("@/lib/supabase/actionAuth", () => ({
  requireUserActionClient: vi.fn(),
}));

// Las actions invalidan la caché del mapa al terminar; fuera de una
// petición de Next, revalidatePath lanza ("static generation store
// missing"), así que se sustituye por un espía.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { requireUserActionClient } from "@/lib/supabase/actionAuth";
import { revalidatePath } from "next/cache";
import {
  createPinAction,
  updatePinAction,
  deletePinAction,
  deleteMapMediaAction,
  addMapMediaAction,
} from "@/app/(app)/mapa/actions";

const validData = {
  sticker_id: 1,
  country_code: "ES",
  state: null,
  place: "Sevilla",
  latitude: 37.4,
  longitude: -6.0,
  created_at: "2026-05-26T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

function mockAuth(userId: string | null) {
  if (userId === null) {
    vi.mocked(requireUserActionClient).mockResolvedValue({
      ok: false,
      error: "No autenticado.",
    });
    return null;
  }
  const stub = createSupabaseStub({ authUserId: userId });
  vi.mocked(requireUserActionClient).mockResolvedValue({
    ok: true,
    supabase: stub.client as never,
    userId,
  });
  return stub;
}

describe("RF-024 · publicar pin", () => {
  it("usuario autenticado con datos válidos: inserta y devuelve pinId", async () => {
    const stub = createSupabaseStub({
      authUserId: "u-A",
      // .insert(...).select(...).single() → { id: 42 }
      from: { pin: { data: { id: 42 }, error: null } },
    });
    vi.mocked(requireUserActionClient).mockResolvedValue({
      ok: true,
      supabase: stub.client as never,
      userId: "u-A",
    });

    const result = await createPinAction(validData);
    expect(result).toEqual({ ok: true, pinId: 42 });
    // El mapa se invalida aquí y no con un router.refresh() en el cliente:
    // lanzado junto al router.push() cancelaba la navegación y dejaba el
    // formulario colgado con el pin ya guardado.
    expect(revalidatePath).toHaveBeenCalledWith("/mapa");
  });

  it("usuario no autenticado: rechazado sin tocar la tabla pin", async () => {
    mockAuth(null);
    const result = await createPinAction(validData);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("No autenticado");
  });

  it("RN-019 · latitud fuera de [-90, 90] rechazada en TS", async () => {
    mockAuth("u-A");
    const r1 = await createPinAction({ ...validData, latitude: 90.1 });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error).toContain("Latitud");

    const r2 = await createPinAction({ ...validData, latitude: -90.1 });
    expect(r2.ok).toBe(false);
  });

  it("RN-019 · longitud fuera de [-180, 180] rechazada en TS", async () => {
    mockAuth("u-A");
    const r1 = await createPinAction({ ...validData, longitude: 180.1 });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error).toContain("Longitud");
  });

  it("acumula errores: lat fuera + place vacío → ambos mensajes", async () => {
    mockAuth("u-A");
    const result = await createPinAction({
      ...validData,
      latitude: 999,
      place: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Latitud");
      expect(result.error).toContain("Faltan campos");
    }
  });
});

describe("RF-025 / RN-018 · editar pin", () => {
  // canEditPin lee from("pin") + posiblemente rpc("is_staff"). Modelamos
  // las tres situaciones controlando el resultado del from y del rpc.
  function setupCanEdit({
    ownerId,
    isStaff,
    currentUserId,
  }: {
    ownerId: string | null;
    isStaff: boolean;
    currentUserId: string;
  }) {
    const fromImpl = vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "update"] as const) chain[m] = () => chain;
      chain.maybeSingle = () => chain;
      chain.then = (onF: (v: unknown) => unknown) => {
        if (table === "pin") {
          return Promise.resolve({
            data: ownerId ? { user_id: ownerId } : null,
            error: null,
          }).then(onF);
        }
        return Promise.resolve({ data: null, error: null }).then(onF);
      };
      return chain;
    });
    const stub = createSupabaseStub({
      authUserId: currentUserId,
      rpc: { is_staff: { data: isStaff, error: null } },
    });
    stub.client.from = fromImpl as never;
    vi.mocked(requireUserActionClient).mockResolvedValue({
      ok: true,
      supabase: stub.client as never,
      userId: currentUserId,
    });
    return stub;
  }

  it("autor del pin puede editarlo", async () => {
    setupCanEdit({ ownerId: "u-A", isStaff: false, currentUserId: "u-A" });
    const result = await updatePinAction(1, validData);
    expect(result.ok).toBe(true);
  });

  it("no autor sin rol staff: rechazado", async () => {
    setupCanEdit({ ownerId: "u-A", isStaff: false, currentUserId: "u-OTHER" });
    const result = await updatePinAction(1, validData);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("permiso");
  });

  it("RN-018 · staff puede editar un pin ajeno", async () => {
    setupCanEdit({ ownerId: "u-A", isStaff: true, currentUserId: "u-MOD" });
    const result = await updatePinAction(1, validData);
    expect(result.ok).toBe(true);
  });

  it("autor puede editar pero con datos inválidos: rechazado", async () => {
    setupCanEdit({ ownerId: "u-A", isStaff: false, currentUserId: "u-A" });
    const result = await updatePinAction(1, { ...validData, latitude: 999 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Latitud");
  });
});

describe("RF-026 · eliminar pin (RN-018)", () => {
  it("autor borra pin: la action invoca delete sobre la tabla pin", async () => {
    const tableCalls: string[] = [];
    const fromImpl = vi.fn((table: string) => {
      tableCalls.push(table);
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "delete", "returns"] as const) {
        chain[m] = () => chain;
      }
      chain.maybeSingle = () => chain;
      chain.then = (onF: (v: unknown) => unknown) => {
        if (table === "pin") {
          // Primera llamada: lookup owner. Segunda: delete.
          const isOwnerLookup =
            tableCalls.filter((t) => t === "pin").length === 1;
          return Promise.resolve(
            isOwnerLookup
              ? { data: { user_id: "u-A" }, error: null }
              : { data: null, error: null },
          ).then(onF);
        }
        if (table === "map_media") {
          return Promise.resolve({ data: [], error: null }).then(onF);
        }
        return Promise.resolve({ data: null, error: null }).then(onF);
      };
      return chain;
    });
    const stub = createSupabaseStub({
      authUserId: "u-A",
      rpc: { is_staff: { data: false, error: null } },
    });
    stub.client.from = fromImpl as never;
    vi.mocked(requireUserActionClient).mockResolvedValue({
      ok: true,
      supabase: stub.client as never,
      userId: "u-A",
    });

    const result = await deletePinAction(99);
    expect(result.ok).toBe(true);
    // Esperamos al menos: from("pin") para owner + from("map_media") +
    // from("map_media") para delete + from("pin") para delete.
    const pinCount = tableCalls.filter((t) => t === "pin").length;
    const mediaCount = tableCalls.filter((t) => t === "map_media").length;
    expect(pinCount).toBeGreaterThanOrEqual(2);
    expect(mediaCount).toBeGreaterThanOrEqual(2);
  });

  it("no autor / no staff: rechazado sin borrar", async () => {
    const tableCalls: string[] = [];
    const fromImpl = vi.fn((table: string) => {
      tableCalls.push(table);
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "delete"] as const) chain[m] = () => chain;
      chain.maybeSingle = () => chain;
      chain.then = (onF: (v: unknown) => unknown) =>
        Promise.resolve(
          table === "pin"
            ? { data: { user_id: "u-OWNER" }, error: null }
            : { data: null, error: null },
        ).then(onF);
      return chain;
    });
    const stub = createSupabaseStub({
      authUserId: "u-OTHER",
      rpc: { is_staff: { data: false, error: null } },
    });
    stub.client.from = fromImpl as never;
    vi.mocked(requireUserActionClient).mockResolvedValue({
      ok: true,
      supabase: stub.client as never,
      userId: "u-OTHER",
    });

    const result = await deletePinAction(99);
    expect(result.ok).toBe(false);
    // Solo se intenta el lookup; la action sale antes de tocar map_media.
    expect(tableCalls).toEqual(["pin"]);
  });
});

describe("multimedia obligatorio · borrar un archivo del pin", () => {
  // deleteMapMediaAction hace, en orden: canEditPin (from("pin") +
  // quizá rpc), lookup del archivo a borrar y recuento de los archivos
  // del pin. `mediaRows` fija cuántos hay en ese recuento.
  function setupDeleteMedia({ mediaRows }: { mediaRows: Array<{ id: number }> }) {
    const tableCalls: string[] = [];
    const deleteCalls: string[] = [];
    const fromImpl = vi.fn((table: string) => {
      tableCalls.push(table);
      const mediaCallIdx = tableCalls.filter((t) => t === "map_media").length;
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "returns"] as const) chain[m] = () => chain;
      chain.delete = () => {
        deleteCalls.push(table);
        return chain;
      };
      chain.maybeSingle = () => chain;
      chain.then = (onF: (v: unknown) => unknown) => {
        if (table === "pin") {
          return Promise.resolve({ data: { user_id: "u-A" }, error: null }).then(onF);
        }
        if (table === "map_media") {
          // 1ª: el archivo concreto. 2ª: el recuento del pin.
          return Promise.resolve(
            mediaCallIdx === 1
              ? { data: { path: "map-media/9/a.webp" }, error: null }
              : { data: mediaRows, error: null },
          ).then(onF);
        }
        return Promise.resolve({ data: null, error: null }).then(onF);
      };
      return chain;
    });
    const stub = createSupabaseStub({
      authUserId: "u-A",
      rpc: { is_staff: { data: false, error: null } },
    });
    stub.client.from = fromImpl as never;
    vi.mocked(requireUserActionClient).mockResolvedValue({
      ok: true,
      supabase: stub.client as never,
      userId: "u-A",
    });
    return { stub, deleteCalls };
  }

  it("con varios archivos, el borrado sigue adelante", async () => {
    const { stub, deleteCalls } = setupDeleteMedia({ mediaRows: [{ id: 1 }, { id: 2 }] });
    const result = await deleteMapMediaAction(1, 9);
    expect(result.ok).toBe(true);
    expect(deleteCalls).toContain("map_media");
    expect(stub.calls.storageRemove).toHaveLength(1);
  });

  it("con un solo archivo, se rechaza: el pin no puede quedarse sin multimedia", async () => {
    const { stub, deleteCalls } = setupDeleteMedia({ mediaRows: [{ id: 1 }] });
    const result = await deleteMapMediaAction(1, 9);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("al menos un archivo multimedia");
    // Ni la fila ni el objeto de storage se tocan.
    expect(deleteCalls).toEqual([]);
    expect(stub.calls.storageRemove).toEqual([]);
  });
});

// ─── Vídeos en Bunny Stream ──────────────────────────────────────────────────

const GUID_1 = "11111111-1111-4111-8111-111111111111";
const GUID_2 = "22222222-2222-4222-8222-222222222222";
const BUNNY_ENV = {
  BUNNY_STREAM_LIBRARY_ID: "12345",
  BUNNY_STREAM_API_KEY: "test-api-key",
  BUNNY_STREAM_READONLY_API_KEY: "test-readonly-key",
  BUNNY_STREAM_TOKEN_KEY: "test-token-key",
  NEXT_PUBLIC_BUNNY_CDN_HOSTNAME: "vz-test.b-cdn.net",
};

describe("borrado de vídeos alojados en Bunny", () => {
  let events: string[];

  beforeEach(() => {
    events = [];
    for (const [key, value] of Object.entries(BUNNY_ENV)) vi.stubEnv(key, value);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // Bunny responde por GUID; cada DELETE queda registrado en `events`.
  function mockBunnyDelete(statusFor: (guid: string) => number) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const guid = url.split("/").pop()!;
        events.push(`bunny:${init?.method}:${guid}`);
        return new Response(null, { status: statusFor(guid) });
      }),
    );
  }

  // Pin del usuario con 1 foto y 2 vídeos de Bunny. Registra en `events`
  // cuándo se borra cada tabla, para comprobar el orden BD → Bunny.
  function setupPinWithMedia() {
    const fromImpl = vi.fn((table: string) => {
      let op = "select";
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "returns"] as const) chain[m] = () => chain;
      chain.delete = () => {
        op = "delete";
        return chain;
      };
      chain.maybeSingle = () => chain;
      chain.then = (onF: (v: unknown) => unknown) => {
        if (op === "delete") {
          events.push(`db:delete:${table}`);
          return Promise.resolve({ data: null, error: null }).then(onF);
        }
        if (table === "pin") {
          return Promise.resolve({ data: { user_id: "u-A" }, error: null }).then(onF);
        }
        return Promise.resolve({
          data: [
            { path: "map-media/9/foto.webp", bunny_video_id: null },
            { path: null, bunny_video_id: GUID_1 },
            { path: null, bunny_video_id: GUID_2 },
          ],
          error: null,
        }).then(onF);
      };
      return chain;
    });
    const stub = createSupabaseStub({
      authUserId: "u-A",
      rpc: { is_staff: { data: false, error: null } },
    });
    stub.client.from = fromImpl as never;
    vi.mocked(requireUserActionClient).mockResolvedValue({
      ok: true,
      supabase: stub.client as never,
      userId: "u-A",
    });
    return stub;
  }

  it("borrar un pin con 2 vídeos de Bunny y 1 foto: 2 DELETE a Bunny después del borrado en BD", async () => {
    const stub = setupPinWithMedia();
    mockBunnyDelete(() => 200);

    const result = await deletePinAction(9);
    expect(result.ok).toBe(true);

    // La foto se sigue borrando de Storage; los vídeos de Bunny no tienen path.
    expect(stub.calls.storageRemove).toEqual([
      { bucket: "solarhub-assets", paths: ["map-media/9/foto.webp"] },
    ]);
    const pinDeleted = events.indexOf("db:delete:pin");
    expect(pinDeleted).toBeGreaterThanOrEqual(0);
    expect(events.slice(pinDeleted + 1)).toEqual([
      `bunny:DELETE:${GUID_1}`,
      `bunny:DELETE:${GUID_2}`,
    ]);
  });

  it("un fallo de Bunny no hace fallar el borrado del pin", async () => {
    setupPinWithMedia();
    mockBunnyDelete((guid) => (guid === GUID_1 ? 503 : 200));

    const result = await deletePinAction(9);
    expect(result.ok).toBe(true);
    // Se intenta igualmente el segundo.
    expect(events).toContain(`bunny:DELETE:${GUID_2}`);
  });

  it("sin variables de Bunny el pin se borra igual (los vídeos quedan para cleanup.ts)", async () => {
    for (const key of Object.keys(BUNNY_ENV)) vi.stubEnv(key, "");
    setupPinWithMedia();
    mockBunnyDelete(() => 200);
    expect((await deletePinAction(9)).ok).toBe(true);
    expect(events.filter((e) => e.startsWith("bunny:"))).toEqual([]);
  });

  it("borrar un vídeo de Bunny desde la edición: fila primero, después Bunny; nada en Storage", async () => {
    const tableCalls: string[] = [];
    const fromImpl = vi.fn((table: string) => {
      tableCalls.push(table);
      const mediaCallIdx = tableCalls.filter((t) => t === "map_media").length;
      let op = "select";
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "returns"] as const) chain[m] = () => chain;
      chain.delete = () => {
        op = "delete";
        return chain;
      };
      chain.maybeSingle = () => chain;
      chain.then = (onF: (v: unknown) => unknown) => {
        if (op === "delete") {
          events.push(`db:delete:${table}`);
          return Promise.resolve({ data: null, error: null }).then(onF);
        }
        if (table === "pin") return Promise.resolve({ data: { user_id: "u-A" }, error: null }).then(onF);
        return Promise.resolve(
          mediaCallIdx === 1
            ? { data: { path: null, bunny_video_id: GUID_1 }, error: null }
            : { data: [{ id: 1 }, { id: 2 }], error: null },
        ).then(onF);
      };
      return chain;
    });
    const stub = createSupabaseStub({ authUserId: "u-A", rpc: { is_staff: { data: false, error: null } } });
    stub.client.from = fromImpl as never;
    vi.mocked(requireUserActionClient).mockResolvedValue({
      ok: true,
      supabase: stub.client as never,
      userId: "u-A",
    });
    mockBunnyDelete(() => 200);

    expect((await deleteMapMediaAction(1, 9)).ok).toBe(true);
    expect(stub.calls.storageRemove).toEqual([]);
    expect(events).toEqual(["db:delete:map_media", `bunny:DELETE:${GUID_1}`]);
  });
});

describe("addMapMediaAction · solo fotos", () => {
  it("rechaza VIDEO: los vídeos nuevos van a Bunny por su propio flujo", async () => {
    const stub = createSupabaseStub({
      authUserId: "u-A",
      from: { pin: { data: { user_id: "u-A" }, error: null }, map_media: { data: null, error: null } },
      rpc: { is_staff: { data: false, error: null } },
    });
    vi.mocked(requireUserActionClient).mockResolvedValue({
      ok: true,
      supabase: stub.client as never,
      userId: "u-A",
    });

    const result = await addMapMediaAction(9, [
      { path: "map-media/9/v.mp4", type: "VIDEO", mimeType: "video/mp4", size: 1000 },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("tipo no permitido");
    expect(stub.calls.from.some((c) => c.table === "map_media")).toBe(false);
  });

  it("las fotos siguen insertándose", async () => {
    const stub = createSupabaseStub({
      authUserId: "u-A",
      from: { pin: { data: { user_id: "u-A" }, error: null }, map_media: { data: null, error: null } },
      rpc: { is_staff: { data: false, error: null } },
    });
    vi.mocked(requireUserActionClient).mockResolvedValue({
      ok: true,
      supabase: stub.client as never,
      userId: "u-A",
    });

    const result = await addMapMediaAction(9, [
      { path: "map-media/9/f.webp", type: "PHOTO", mimeType: "image/webp", size: 1000 },
    ]);
    expect(result.ok).toBe(true);
    const insert = stub.calls.from.find((c) => c.table === "map_media" && c.chain.includes("insert"))!;
    expect(insert.args[0][0]).toEqual({ pin_id: 9, path: "map-media/9/f.webp", type: "PHOTO" });
  });
});

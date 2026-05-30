// SUT: src/app/(app)/mapa/actions.ts → createPinAction, updatePinAction, deletePinAction
// Cubre RF-024 (publicar pin), RF-025 (editar), RF-026 (eliminar) y RN-018 (autoría).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseStub } from "../fixtures/supabaseMock";

vi.mock("@/lib/supabase/actionAuth", () => ({
  requireUserActionClient: vi.fn(),
}));

import { requireUserActionClient } from "@/lib/supabase/actionAuth";
import {
  createPinAction,
  updatePinAction,
  deletePinAction,
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

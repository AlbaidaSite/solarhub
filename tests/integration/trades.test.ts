// SUT: src/app/(app)/intercambios/actions.ts → startTradeAction, cancelTradeAction
//      src/app/(app)/intercambios/[id]/actions.ts → accept/unaccept/add/remove
//
// Cubre RF-016 a RF-021 y RN-014 a RN-017. La mayoría de la lógica vive en
// la RPC `start_trade` y en triggers SQL (`trg_complete_trade_on_mutual_acceptance`,
// `trg_reset_acceptance`, `trg_unique_not_in_active_trade`). Aquí
// verificamos:
//   · que la action llama a la RPC con los argumentos correctos.
//   · que transforma el `jsonb` devuelto en el `Result` esperado.
//   · que propaga errores conocidos.
// Lo que vive en triggers se marca como E2E pendiente.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseStub } from "../fixtures/supabaseMock";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  startTradeAction,
  cancelTradeAction,
  addUniqueToMyTradeOfferAction,
} from "@/app/(app)/intercambios/actions";
import {
  acceptTradeAction,
  unacceptTradeAction,
} from "@/app/(app)/intercambios/[id]/actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RF-016 · iniciar intercambio (RN-014 / RN-015)", () => {
  it("invoca la RPC start_trade y propaga el trade_id", async () => {
    const { client, calls } = createSupabaseStub({
      authUserId: "u-A",
      rpc: { start_trade: { data: { ok: true, trade_id: 77 }, error: null } },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);

    const result = await startTradeAction("u-B");
    expect(result).toEqual({ ok: true, tradeId: 77 });
    expect(calls.rpc).toEqual([
      { name: "start_trade", args: { p_other_user_id: "u-B" } },
    ]);
  });

  it("RN-014 · trade consigo mismo: la RPC devuelve fallo y la action lo propaga", async () => {
    const { client } = createSupabaseStub({
      authUserId: "u-A",
      rpc: {
        start_trade: {
          data: { ok: false, error: "No puedes intercambiar contigo mismo." },
          error: null,
        },
      },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);

    const result = await startTradeAction("u-A");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("contigo mismo");
    }
  });

  it("RN-015 · trade abierto preexistente: la RPC lo reusa", async () => {
    // La RPC `start_trade` devuelve el id del trade existente; el contrato
    // del cliente es el mismo (ok:true, trade_id). El comportamiento real
    // de reuse vs creación vive en la RPC SQL.
    const { client } = createSupabaseStub({
      authUserId: "u-A",
      rpc: { start_trade: { data: { ok: true, trade_id: 50 }, error: null } },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);

    const result = await startTradeAction("u-B");
    expect(result).toEqual({ ok: true, tradeId: 50 });
  });

  it("respuesta inesperada (sin trade_id): devuelve error genérico", async () => {
    const { client } = createSupabaseStub({
      authUserId: "u-A",
      rpc: { start_trade: { data: { ok: true }, error: null } },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);

    const result = await startTradeAction("u-B");
    expect(result.ok).toBe(false);
  });
});

describe("RF-017 · añadir copia a la oferta propia (RN-016)", () => {
  it("requiere autenticación", async () => {
    const { client } = createSupabaseStub({ authUserId: null });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);

    const result = await addUniqueToMyTradeOfferAction(1, 100);
    expect(result.ok).toBe(false);
  });

  it("rechaza si el usuario no tiene oferta en el trade", async () => {
    // Construimos un stub donde el lookup de trade_offer no encuentra fila.
    const fromImpl = vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "limit"] as const) {
        chain[m] = () => chain;
      }
      chain.maybeSingle = () => chain;
      chain.then = (onF: (v: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onF);
      void table;
      return chain;
    });
    const stub = createSupabaseStub({ authUserId: "u-A" });
    stub.client.from = fromImpl as never;
    vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client as never);

    const result = await addUniqueToMyTradeOfferAction(1, 100);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("parte de este intercambio");
  });
});

describe("RF-019 · aceptar / desaceptar oferta", () => {
  it("aceptar: pasa is_accepted=true para la oferta del usuario en el trade", async () => {
    const { client, calls } = createSupabaseStub({
      authUserId: "u-A",
      from: { trade_offer: { data: null, error: null } },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);

    const result = await acceptTradeAction(7);
    expect(result).toEqual({ ok: true });

    const offerCall = calls.from.find((c) => c.table === "trade_offer");
    expect(offerCall?.chain).toContain("update");
    const updateArgs = offerCall?.args[offerCall.chain.indexOf("update")];
    expect(updateArgs?.[0]).toEqual({ is_accepted: true });
  });

  it("desaceptar: pasa is_accepted=false", async () => {
    const { client, calls } = createSupabaseStub({
      authUserId: "u-A",
      from: { trade_offer: { data: null, error: null } },
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);

    await unacceptTradeAction(7);

    const offerCall = calls.from.find((c) => c.table === "trade_offer");
    const updateArgs = offerCall?.args[offerCall.chain.indexOf("update")];
    expect(updateArgs?.[0]).toEqual({ is_accepted: false });
  });
});

describe("RF-021 · cancelar intercambio", () => {
  it("verifica participación y borra el trade", async () => {
    // Lookup encuentra el trade (usuario es parte); luego delete.
    const fromImpl = vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      for (const m of [
        "select",
        "eq",
        "or",
        "delete",
        "limit",
      ] as const) {
        chain[m] = () => chain;
      }
      chain.maybeSingle = () => chain;
      chain.then = (onF: (v: unknown) => unknown) => {
        // Primera llamada (lookup) devuelve el trade.
        // Las siguientes (delete) devuelven null sin error.
        return Promise.resolve(
          fromImpl.mock.calls.length === 1
            ? { data: { id: 7 }, error: null }
            : { data: null, error: null },
        ).then(onF);
      };
      void table;
      return chain;
    });
    const stub = createSupabaseStub({ authUserId: "u-A" });
    stub.client.from = fromImpl as never;
    vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client as never);

    const result = await cancelTradeAction(7);
    expect(result.ok).toBe(true);
  });
});

describe("RF-020 / RN-016 / RN-017 · cierre y swap (E2E pendiente)", () => {
  // Lo gestiona el trigger trg_complete_trade_on_mutual_acceptance:
  // cuando ambos trade_offer.is_accepted pasan a true, el trigger marca
  // trade.is_mutual_agreement=true, cierra los current owners anteriores
  // e inserta los nuevos cruzados. Sin BD real no es verificable.
  it.skip("RF-020 · cierre por mutuo acuerdo y swap de propiedad", () => {});
  it.skip("RN-016 · al cierre, una copia que ya no pertenece al ofertante → el trade NO debería completarse (gap conocido)", () => {});
});
